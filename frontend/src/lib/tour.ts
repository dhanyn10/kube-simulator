import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';

export const startTour = (colorMode: 'dark' | 'light') => {
  const isDark = colorMode === 'dark';

  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      classes: isDark ? 'shepherd-theme-dark' : 'shepherd-theme-light',
      scrollTo: { behavior: 'smooth', block: 'center' },
      cancelIcon: {
        enabled: true
      }
    }
  });

  const buttonClasses = 'px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all shadow-sm';
  const nextBtnClass = `${buttonClasses} bg-blue-600 hover:bg-blue-500 text-white`;
  const backBtnClass = `${buttonClasses} ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`;

  tour.addStep({
    id: 'sidebar',
    title: 'Components Sidebar',
    text: 'Here you can find all the Kubernetes resources you can add to your architecture. Simply drag and drop them onto the canvas.',
    attachTo: {
      element: '#sidebar-components',
      on: 'right'
    },
    buttons: [
      {
        text: 'Next',
        classes: nextBtnClass,
        action: tour.next
      }
    ]
  });

  tour.addStep({
    id: 'canvas',
    title: 'Design Canvas',
    text: 'This is your workspace. You can arrange nodes, connect them to define relationships, and visualize your cluster architecture.',
    attachTo: {
      element: '#canvas-main',
      on: 'bottom'
    },
    buttons: [
      {
        text: 'Back',
        classes: backBtnClass,
        action: tour.back
      },
      {
        text: 'Next',
        classes: nextBtnClass,
        action: tour.next
      }
    ]
  });

  tour.addStep({
    id: 'simulation',
    title: 'Simulation Controls',
    text: 'Once you have an Internet node and a valid architecture, use these controls to start or stop the simulation and see how traffic flows.',
    attachTo: {
      element: '#simulation-controls',
      on: 'bottom'
    },
    buttons: [
      {
        text: 'Back',
        classes: backBtnClass,
        action: tour.back
      },
      {
        text: 'Next',
        classes: nextBtnClass,
        action: tour.next
      }
    ]
  });

  tour.addStep({
    id: 'right-sidebar',
    title: 'Settings & Widgets',
    text: 'Select any node or edge to configure its properties here. You can also view real-time cluster statistics and resource budgets.',
    attachTo: {
      element: '#right-sidebar',
      on: 'left'
    },
    buttons: [
      {
        text: 'Back',
        classes: backBtnClass,
        action: tour.back
      },
      {
        text: 'Next',
        classes: nextBtnClass,
        action: tour.next
      }
    ]
  });

  tour.addStep({
    id: 'logs',
    title: 'Activity Logs',
    text: 'Keep track of backend activities, errors, and simulation events through these notifications and the detailed log modal.',
    attachTo: {
      element: '#log-toast',
      on: 'top'
    },
    buttons: [
      {
        text: 'Back',
        classes: backBtnClass,
        action: tour.back
      },
      {
        text: 'Finish',
        classes: nextBtnClass,
        action: tour.complete
      }
    ]
  });

  tour.start();
};
