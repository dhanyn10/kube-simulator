import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import { useFlowStore } from '../store';
import { GuidedTourType } from '../components/Modals/TourSelectionModal';

interface TourStep {
  id: string;
  title: string;
  text: string;
  element?: string;
  on?: 'top' | 'bottom' | 'left' | 'right';
  verify?: () => { success: boolean; hint?: string };
}

/**
 * Checks if a Pod/Workload node is positioned to the right of an Internet node
 * and connected by a valid ReactFlow Edge.
 */
export const verifyInternetToPodConnection = (): { success: boolean; hint?: string } => {
  const { nodes, edges } = useFlowStore.getState();

  const internetNode = nodes.find((n) => n.type === 'Internet');
  if (!internetNode) {
    return { success: false, hint: 'Please drag an Internet node onto the canvas from the highlighted sidebar card.' };
  }

  const targetNode = nodes.find((n) => n.type === 'Pod' || n.type === 'Deployment' || n.type === 'Service');
  if (!targetNode) {
    return { success: false, hint: 'Please drag a Pod or Workload card onto the canvas.' };
  }

  // Position check: targetNode must be to the right of internetNode (x coordinate)
  const isToTheRight = targetNode.position.x > internetNode.position.x + 50;
  if (!isToTheRight) {
    return {
      success: false,
      hint: `Positioning Check: Move '${targetNode.data?.label || targetNode.type}' to the RIGHT side of the 'Internet' card.`,
    };
  }

  // Edge connection check: source or target connection between internet and workload
  const isConnected = edges.some(
    (e) =>
      (e.source === internetNode.id && e.target === targetNode.id) ||
      (e.target === internetNode.id && e.source === targetNode.id)
  );

  if (!isConnected) {
    return {
      success: false,
      hint: `Connection Check: Connect a line/edge from the 'Internet' handle to '${targetNode.data?.label || targetNode.type}'.`,
    };
  }

  return { success: true };
};

/**
 * Checks if a Role with a custom User name has been attached to any canvas node.
 */
export const verifyRbacRoleAttachment = (): { success: boolean; hint?: string } => {
  const { nodes } = useFlowStore.getState();

  const nodeWithRole = nodes.find((n) => Array.isArray(n.data?.roles) && n.data.roles.length > 0);
  if (!nodeWithRole) {
    return { success: false, hint: 'Please drag the highlighted Role item from the sidebar and drop it onto a canvas card.' };
  }

  const roleItem = nodeWithRole.data.roles[0];
  const hasUser = Boolean(roleItem.userName || roleItem.subjects?.[0]?.name);
  if (!hasUser) {
    return { success: false, hint: 'In the Role Modal, specify a User / Subject Name (e.g. alice) before saving.' };
  }

  return { success: true };
};

/**
 * Checks if an HPA has been attached to a Deployment or workload node.
 */
export const verifyHpaAttachment = (): { success: boolean; hint?: string } => {
  const { nodes } = useFlowStore.getState();

  const nodeWithHpa = nodes.find((n) => Array.isArray(n.data?.hpas) && n.data.hpas.length > 0);
  if (!nodeWithHpa) {
    return { success: false, hint: 'Please drag the highlighted HPA item from the sidebar and drop it onto a Deployment card.' };
  }

  return { success: true };
};

/**
 * Checks if a ConfigMap or Secret has been attached to any canvas card.
 */
export const verifyConfigBinding = (): { success: boolean; hint?: string } => {
  const { nodes } = useFlowStore.getState();

  const nodeWithConfig = nodes.find(
    (n) => (Array.isArray(n.data?.configMaps) && n.data.configMaps.length > 0) || (Array.isArray(n.data?.secrets) && n.data.secrets.length > 0)
  );

  if (!nodeWithConfig) {
    return { success: false, hint: 'Please drag a ConfigMap or Secret item from the highlighted sidebar and drop it onto a card.' };
  }

  return { success: true };
};

export const startTour = (colorMode: 'dark' | 'light', tourType: GuidedTourType = 'intro') => {
  const isDark = colorMode === 'dark';

  // Ensure sidebar is visible when tour starts
  useFlowStore.getState().setSidebarVisible(true);

  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      classes: isDark ? 'shepherd-theme-dark' : 'shepherd-theme-light',
      scrollTo: { behavior: 'smooth', block: 'center' },
      cancelIcon: { enabled: true },
    },
  });

  const btnBase = 'px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all shadow-sm cursor-pointer';
  const nextBtnClass = `${btnBase} bg-blue-600 hover:bg-blue-500 text-white`;
  const backBtnClass = `${btnBase} ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`;
  const verifyBtnClass = `${btnBase} bg-emerald-600 hover:bg-emerald-500 text-white`;

  let steps: TourStep[] = [];

  if (tourType === 'arch') {
    steps = [
      {
        id: 'arch-step1',
        title: '🌐 Step 1: Pick Up the Internet Node',
        text: "Game Mission: Drag this highlighted 'Internet' card from the sidebar and drop it onto the canvas on the left side.",
        element: '#sidebar-item-Internet',
        on: 'right',
      },
      {
        id: 'arch-step2',
        title: '📦 Step 2: Pick Up the Pod Card',
        text: "Drag this highlighted 'Pod' card and place it on the RIGHT side of your Internet node on the canvas.",
        element: '#sidebar-item-Pod',
        on: 'right',
      },
      {
        id: 'arch-verify',
        title: '🔗 Step 3: Connect & Verify Architecture',
        text: "Connect an edge line from 'Internet' to 'Pod' (placed on its right). Once done, click 'Verify Action ✓'.",
        element: '#canvas-main',
        on: 'bottom',
        verify: verifyInternetToPodConnection,
      },
      {
        id: 'arch-complete',
        title: '🎉 Level 1 Complete!',
        text: 'Great job! Your Internet traffic node is connected to the workload on its right side. Click Start Simulation in the top bar to watch traffic flow.',
        element: '#simulation-controls',
        on: 'bottom',
      },
    ];
  } else if (tourType === 'rbac') {
    steps = [
      {
        id: 'rbac-step1',
        title: '🛡️ Step 1: Highlighted Role Card',
        text: "Game Mission: Drag this highlighted 'Role' item and drop it onto any card on the canvas (e.g. Deployment or Pod).",
        element: '#sidebar-item-Role',
        on: 'right',
      },
      {
        id: 'rbac-verify',
        title: '👤 Step 2: Assign User Name & Toggles',
        text: "In the modal, type a User / Subject Name (e.g. 'alice') and check permission toggles (Read, Write, Delete). Then click 'Attach Role' and press 'Verify Action ✓'.",
        element: '#canvas-main',
        on: 'bottom',
        verify: verifyRbacRoleAttachment,
      },
      {
        id: 'rbac-complete',
        title: '🎉 Security Level Complete!',
        text: "Role and User attached successfully! Hover over the shield icon on the card or run 'kubectl get roles' in the Kube Console terminal to inspect permissions.",
        element: '#right-sidebar',
        on: 'left',
      },
    ];
  } else if (tourType === 'hpa') {
    steps = [
      {
        id: 'hpa-step1',
        title: '📈 Step 1: Pick Up HPA Card',
        text: "Game Mission: Drag this highlighted 'HPA' card from the sidebar and drop it onto a Deployment card.",
        element: '#sidebar-item-HPA',
        on: 'right',
      },
      {
        id: 'hpa-verify',
        title: '⚡ Step 2: Configure Autoscaling',
        text: "Configure Min/Max Replicas and Target CPU threshold in the modal, then click 'Verify Action ✓'.",
        element: '#canvas-main',
        on: 'bottom',
        verify: verifyHpaAttachment,
      },
      {
        id: 'hpa-complete',
        title: '🎉 HPA Auto-scaling Active!',
        text: "HPA attached! During active simulation, workload replicas will scale automatically based on CPU traffic load.",
        element: '#simulation-controls',
        on: 'bottom',
      },
    ];
  } else if (tourType === 'config') {
    steps = [
      {
        id: 'config-step1',
        title: '🔒 Step 1: Select ConfigMap or Secret',
        text: "Game Mission: Drag this highlighted 'ConfigMap' or 'Secret' card from the sidebar and drop it onto a workload card.",
        element: '#sidebar-item-ConfigMap',
        on: 'right',
      },
      {
        id: 'config-verify',
        title: '🔑 Step 2: Save Data & Verify',
        text: "Set Key-Value configuration data and save, then click 'Verify Action ✓'.",
        element: '#canvas-main',
        on: 'bottom',
        verify: verifyConfigBinding,
      },
      {
        id: 'config-complete',
        title: '🎉 Config Binding Complete!',
        text: "ConfigMap/Secret bound successfully! Click the card to view settings or run 'kubectl get configmaps' in the terminal.",
        element: '#right-sidebar',
        on: 'left',
      },
    ];
  } else {
    // Quick App Overview
    steps = [
      {
        id: 'sidebar',
        title: 'Components Sidebar',
        text: 'Here you can find all Kubernetes resources (Compute, Networking, Security, Storage). Simply drag and drop them onto the canvas.',
        element: '#sidebar-components',
        on: 'right',
      },
      {
        id: 'canvas',
        title: 'Design Canvas',
        text: 'This is your workspace. Arrange nodes, connect edges to define relationships, and visualize your cluster architecture.',
        element: '#canvas-main',
        on: 'bottom',
      },
      {
        id: 'simulation',
        title: 'Simulation Controls',
        text: 'Use these controls to start or stop the real-time simulation and see traffic flow through your architecture.',
        element: '#simulation-controls',
        on: 'bottom',
      },
      {
        id: 'right-sidebar',
        title: 'Settings & Widgets',
        text: 'Select any node or edge to configure its properties, view cluster resource limits, or manage attached roles and secrets.',
        element: '#right-sidebar',
        on: 'left',
      },
    ];
  }

  steps.forEach((step, index) => {
    const buttons = [];

    if (index > 0) {
      buttons.push({
        text: 'Back',
        classes: backBtnClass,
        action: tour.back,
      });
    }

    if (step.verify) {
      const verifyFn = step.verify;
      buttons.push({
        text: 'Verify Action ✓',
        classes: verifyBtnClass,
        action: function () {
          const res = verifyFn();
          if (res.success) {
            alert('✅ Verification Successful! Great job, proceeding to the next step.');
            tour.next();
          } else {
            alert(`⚠️ Verification Pending:\n\n${res.hint || 'Action requirements not met yet.'}`);
          }
        },
      });
    } else {
      buttons.push({
        text: index === steps.length - 1 ? 'Finish' : 'Next',
        classes: nextBtnClass,
        action: index === steps.length - 1 ? tour.complete : tour.next,
      });
    }

    const beforeShowHook = function (this: Shepherd.Step) {
      if (step.element?.startsWith('#sidebar-item-')) {
        useFlowStore.getState().setSidebarVisible(true);
        setTimeout(() => {
          const el = document.querySelector(step.element!);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    };

    tour.addStep({
      id: step.id,
      title: step.title,
      text: step.text,
      attachTo: step.element ? { element: step.element, on: step.on || 'bottom' } : undefined,
      buttons,
      beforeShowPromise: function () {
        return new Promise((resolve) => {
          beforeShowHook.call(this);
          setTimeout(resolve, 150);
        });
      },
    });
  });

  tour.start();
};
