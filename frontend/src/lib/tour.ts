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
    return { success: false, hint: 'Please drag an Internet node onto the canvas from the sidebar.' };
  }

  const targetNode = nodes.find((n) => n.type === 'Pod' || n.type === 'Deployment' || n.type === 'Service');
  if (!targetNode) {
    return { success: false, hint: 'Please drag a Pod, Service, or Deployment card onto the canvas.' };
  }

  // Position check: targetNode must be to the right of internetNode (x coordinate)
  const isToTheRight = targetNode.position.x > internetNode.position.x + 50;
  if (!isToTheRight) {
    return {
      success: false,
      hint: `Position check: Move '${targetNode.data?.label || targetNode.type}' to the right side of 'Internet' card.`,
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
      hint: `Connection check: Connect an edge line from 'Internet' handle to '${targetNode.data?.label || targetNode.type}'.`,
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
    return { success: false, hint: 'Please drag a Role item from Security & Access sidebar and drop it onto a canvas card.' };
  }

  const roleItem = nodeWithRole.data.roles[0];
  const hasUser = Boolean(roleItem.userName || roleItem.subjects?.[0]?.name);
  if (!hasUser) {
    return { success: false, hint: 'In the Role Modal, specify a User / Subject Name (e.g. alice) before attaching.' };
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
    return { success: false, hint: 'Please drag an HPA from Compute & Workloads sidebar and drop it onto a Deployment card.' };
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
    return { success: false, hint: 'Please drag a ConfigMap or Secret item from Configuration & Storage and drop it onto a card.' };
  }

  return { success: true };
};

export const startTour = (colorMode: 'dark' | 'light', tourType: GuidedTourType = 'intro') => {
  const isDark = colorMode === 'dark';

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
        id: 'arch-intro',
        title: '🌐 Web App Architecture Scenario',
        text: 'In this guided scenario, you will connect an Internet traffic node to a Pod/Workload node positioned on its right side.',
        element: '#sidebar-components',
        on: 'right',
      },
      {
        id: 'arch-verify',
        title: '📍 Step 1: Drag Nodes & Connect Edge',
        text: "Drag an 'Internet' node and a 'Pod' (or 'Service'/'Deployment') onto the canvas. Ensure the Pod is on the RIGHT side of the Internet card, and connect them with an Edge line.",
        element: '#canvas-main',
        on: 'bottom',
        verify: verifyInternetToPodConnection,
      },
      {
        id: 'arch-complete',
        title: '🎉 Architecture Complete!',
        text: 'Great job! Your Internet node is connected to the workload on its right side. Click Start Simulation in the top bar to test traffic flow.',
        element: '#simulation-controls',
        on: 'bottom',
      },
    ];
  } else if (tourType === 'rbac') {
    steps = [
      {
        id: 'rbac-intro',
        title: '🛡️ RBAC User & Security Scenario',
        text: 'In this scenario, you will create a custom User (e.g. alice), configure permission toggles, and attach the Role to a canvas card.',
        element: '#sidebar-components',
        on: 'right',
      },
      {
        id: 'rbac-verify',
        title: '🔒 Step 1: Assign User & Attach Role',
        text: "Drag a 'Role' item from 'Security & Access' and drop it onto a card. In the modal, specify a User Name (e.g. 'alice') and check permission toggles (Read, Write, Delete).",
        element: '#canvas-main',
        on: 'bottom',
        verify: verifyRbacRoleAttachment,
      },
      {
        id: 'rbac-complete',
        title: '🎉 RBAC Security Complete!',
        text: "Role and User attached successfully! Hover over the shield icon on the card or run 'kubectl get roles' in the Kube Console terminal to inspect permissions.",
        element: '#right-sidebar',
        on: 'left',
      },
    ];
  } else if (tourType === 'hpa') {
    steps = [
      {
        id: 'hpa-intro',
        title: '📈 Horizontal Pod Autoscaler Scenario',
        text: 'Learn how to attach an HPA to dynamically scale workload replicas based on CPU traffic.',
        element: '#sidebar-components',
        on: 'right',
      },
      {
        id: 'hpa-verify',
        title: '⚡ Step 1: Attach HPA to Workload',
        text: "Drag an 'HPA' item from 'Compute & Workloads' and drop it onto a Deployment card. Configure Min/Max Replicas and target CPU percentage.",
        element: '#canvas-main',
        on: 'bottom',
        verify: verifyHpaAttachment,
      },
      {
        id: 'hpa-complete',
        title: '🎉 HPA Auto-scaling Active!',
        text: "HPA attached! During active simulation, the workload will automatically scale replicas up or down depending on CPU load.",
        element: '#simulation-controls',
        on: 'bottom',
      },
    ];
  } else if (tourType === 'config') {
    steps = [
      {
        id: 'config-intro',
        title: '🔒 ConfigMaps & Secrets Binding',
        text: 'Learn how to bind environment variables and secrets to workloads.',
        element: '#sidebar-components',
        on: 'right',
      },
      {
        id: 'config-verify',
        title: '🔑 Step 1: Attach ConfigMap or Secret',
        text: "Drag a 'ConfigMap' or 'Secret' item from 'Configuration & Storage' and drop it onto a canvas workload card.",
        element: '#canvas-main',
        on: 'bottom',
        verify: verifyConfigBinding,
      },
      {
        id: 'config-complete',
        title: '🎉 Config Binding Complete!',
        text: "ConfigMap/Secret attached! Click on the card to inspect attached data in the RightSidebar or run 'kubectl get configmaps' in Kube Console.",
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

    tour.addStep({
      id: step.id,
      title: step.title,
      text: step.text,
      attachTo: step.element ? { element: step.element, on: step.on || 'bottom' } : undefined,
      buttons,
    });
  });

  tour.start();
};
