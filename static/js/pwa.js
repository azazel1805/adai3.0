// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/sw.js') // Path to your sw.js
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
} else {
    console.log('Service Worker not supported by this browser.');
}

// Optional: Add to Home Screen prompt handling (can be complex)
// let deferredPrompt;
// window.addEventListener('beforeinstallprompt', (e) => {
//   // Prevent the mini-infobar from appearing on mobile
//   e.preventDefault();
//   // Stash the event so it can be triggered later.
//   deferredPrompt = e;
//   // Update UI notify the user they can install the PWA
//   // showInstallPromotion(); // Example: display a custom install button
//   console.log(`'beforeinstallprompt' event was fired.`);
// });