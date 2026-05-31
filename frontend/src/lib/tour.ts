import introJs from 'intro.js';
import 'intro.js/introjs.css';

export const startWelcomeTour = () => {
  const intro = introJs();

  intro.setOptions({
    tooltipClass: 'custom-tooltip',
    steps: [
      {
        title: 'Selamat Datang!',
        intro: 'Selamat datang di Kube Simulator! Mari kita keliling sejenak untuk memahami cara kerja aplikasi ini.',
      },
      {
        element: '#sidebar-components',
        title: 'Komponen Kubernetes',
        intro: 'Di sini Anda dapat menemukan berbagai komponen Kubernetes seperti Pod, Service, dan Deployment. Klik atau tarik komponen ke kanvas untuk mulai membangun.',
      },
      {
        element: '#canvas-main',
        title: 'Kanvas Arsitektur',
        intro: 'Ini adalah tempat Anda mendesain arsitektur. Anda bisa menghubungkan antar komponen dengan menarik garis dari bulatan di sisi komponen.',
      },
      {
        element: '#right-sidebar',
        title: 'Pengaturan & Widget',
        intro: 'Pilih komponen di kanvas untuk mengubah konfigurasinya di sini. Anda juga bisa melihat statistik penggunaan resource melalui widget yang tersedia.',
      },
      {
        element: '#simulation-controls',
        title: 'Kontrol Simulasi',
        intro: 'Setelah arsitektur siap (pastikan ada komponen Internet), klik tombol Play untuk memulai simulasi trafik dan melihat bagaimana sistem Anda merespon.',
      },
      {
        element: '#log-toast',
        title: 'Log & Notifikasi',
        intro: 'Pantau log sistem dan notifikasi error di sini untuk membantu debugging arsitektur Anda.',
      },
      {
        title: 'Siap Memulai?',
        intro: 'Sekarang giliran Anda! Coba buat arsitektur sederhana atau buka skenario yang sudah ada di menu Resource.',
      }
    ],
    showProgress: true,
    showBullets: false,
    exitOnOverlayClick: false,
    nextLabel: 'Lanjut',
    prevLabel: 'Kembali',
    doneLabel: 'Selesai',
  });

  intro.start();
};
