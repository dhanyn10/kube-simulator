import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';

interface TourStep {
  id: string;
  title: string;
  text: string;
  element: string;
  on: 'top' | 'bottom' | 'left' | 'right';
}

export const startTour = (colorMode: 'dark' | 'light') => {
  const isDark = colorMode === 'dark';

  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      classes: isDark ? 'shepherd-theme-dark' : 'shepherd-theme-light',
      scrollTo: { behavior: 'smooth', block: 'center' },
      cancelIcon: { enabled: true }
    }
  });

  const btnBase = 'px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all shadow-sm';
  const nextBtnClass = `${btnBase} bg-blue-600 hover:bg-blue-500 text-white`;
  const backBtnClass = `${btnBase} ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`;

  const steps: TourStep[] = [
    {
      id: 'sidebar',
      title: 'Components Sidebar',
      text: 'Here you can find all the Kubernetes resources you can add to your architecture. Simply drag and drop them onto the canvas.',
      element: '#sidebar-components',
      on: 'right'
    },
    {
      id: 'canvas',
      title: 'Design Canvas',
      text: 'This is your workspace. You can arrange nodes, connect them to define relationships, and visualize your cluster architecture.',
      element: '#canvas-main',
      on: 'bottom'
    },
    {
      id: 'simulation',
      title: 'Simulation Controls',
      text: 'Once you have an Internet node and a valid architecture, use these controls to start or stop the simulation and see how traffic flows.',
      element: '#simulation-controls',
      on: 'bottom'
    },
    {
      id: 'right-sidebar',
      title: 'Settings & Widgets',
      text: 'Select any node or edge to configure its properties here. You can also view real-time cluster statistics and resource budgets.',
      element: '#right-sidebar',
      on: 'left'
    }
  ];

  steps.forEach((step, index) => {
    const buttons = [];

    if (index > 0) {
      buttons.push({
        text: 'Back',
        classes: backBtnClass,
        action: tour.back
      });
    }

    buttons.push({
      text: index === steps.length - 1 ? 'Finish' : 'Next',
      classes: nextBtnClass,
      action: index === steps.length - 1 ? tour.complete : tour.next
    });

    tour.addStep({
      id: step.id,
      title: step.title,
      text: step.text,
      attachTo: {
        element: step.element,
        on: step.on
      },
      buttons
    });
  });

  tour.start();
};
