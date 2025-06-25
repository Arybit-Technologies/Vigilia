        function showScreen(screenId) {
            document.querySelectorAll('.screen').forEach(screen => {
                screen.classList.remove('active');
            });
            document.getElementById(screenId).classList.add('active');
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            const navItems = document.querySelectorAll('.nav-item');
            const screenMap = { 'home': 0, 'features': 1, 'emergency': 2, 'profile': 3 };
            if (screenMap[screenId] !== undefined) {
                navItems[screenMap[screenId]].classList.add('active');
            }
        }

        function triggerEmergency() {
            showLoading();
            setTimeout(() => {
                hideLoading();
                alert('Emergency services have been notified. Stay safe!');
            }, 3000);
        }

        function shareLocation() {
            showLoading();
            setTimeout(() => {
                hideLoading();
                alert('Live location shared with emergency contacts');
            }, 2000);
        }

        function startRecording() {
            showLoading();
            setTimeout(() => {
                hideLoading();
                alert('Recording started and saved to secure cloud storage');
            }, 1500);
        }

        function showLoading() {
            document.getElementById('loading').classList.remove('d-none');
        }

        function hideLoading() {
            document.getElementById('loading').classList.add('d-none');
        }
