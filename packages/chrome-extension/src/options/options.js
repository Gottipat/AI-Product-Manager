document.getElementById('grant-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        
        statusEl.textContent = '✅ Permission granted! You reflect close this tab safely and start capturing.';
        statusEl.style.color = '#34d399';
        document.getElementById('grant-btn').style.display = 'none';
        
        // Auto-close after 3 seconds
        setTimeout(() => {
            window.close();
        }, 3000);
    } catch (err) {
        statusEl.textContent = '❌ Permission denied. Please check your browser settings or click the permissions icon in your URL bar.';
        statusEl.style.color = '#f87171';
    }
});
