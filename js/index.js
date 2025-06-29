// === Vigilia index.js ===

// === Loading Screen ===
window.addEventListener('load', () => {
  const loading = document.getElementById('loading');
  if (loading) {
    setTimeout(() => {
      loading.classList.add('fade-out');
      setTimeout(() => {
        loading.style.display = 'none';
      }, 500);
    }, 1000);
  }
});

// === Handle Download Button ===
function handleDownload() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  alert(isMobile
    ? '📱 Vigilia will be available soon on Google Play Store and Apple App Store! We\'ll notify you when it\'s ready.'
    : '💻 Desktop version coming soon! For now, Vigilia is optimized for mobile devices.');
}

// === Handle Newsletter Form Submission ===
function handleNewsletter(event) {
  event.preventDefault();
  const emailInput = document.getElementById('emailInput');
  if (!emailInput) return;

  const email = emailInput.value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setTimeout(() => {
      alert(`Thank you for subscribing! We'll send safety updates to ${email}`);
      emailInput.value = '';
    }, 500);
  } else {
    alert('Please enter a valid email address.');
  }
}

// === Header Scroll Effect ===
window.addEventListener('scroll', () => {
  const header = document.getElementById('header');
  const scrollTop = document.getElementById('scrollTop');
  if (header && scrollTop) {
    if (window.scrollY > 100) {
      header.classList.add('scrolled');
      scrollTop.classList.add('visible');
    } else {
      header.classList.remove('scrolled');
      scrollTop.classList.remove('visible');
    }
  }
});

// === Smooth Scroll to Top ===
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// === Animate on Scroll ===
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target); // Unobserve for performance
    }
  });
}, observerOptions);

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
});

// === Particle Effect for Hero Section ===
function createParticle() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const particle = document.createElement('div');
  particle.className = 'particle';
  particle.style.cssText = `
    position: absolute;
    width: 4px;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    pointer-events: none;
    animation: particleFloat 15s infinite linear;
    left: ${Math.random() * 100}%;
    top: 100%;
    animation-delay: ${Math.random() * 15}s;
  `;
  hero.appendChild(particle);
  setTimeout(() => particle.remove(), 15000);
}

// Add Particle Animation CSS
document.addEventListener('DOMContentLoaded', () => {
  const particleStyle = document.createElement('style');
  particleStyle.textContent = `
    @keyframes particleFloat {
      0% { transform: translateY(0) rotate(0deg); opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
    }
  `;
  document.head.appendChild(particleStyle);

  if (document.querySelector('.hero')) {
    setInterval(createParticle, 2000);
  }
});

// === Typing Effect for Hero Subtitle ===
function typeWriter(element, text, speed = 100) {
  if (!element) return;
  let i = 0;
  element.innerHTML = '';

  function type() {
    if (i < text.length) {
      element.innerHTML += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  type();
}

document.addEventListener('DOMContentLoaded', () => {
  const subtitle = document.querySelector('.hero-subtitle');
  if (subtitle) {
    const originalText = subtitle.textContent;
    setTimeout(() => typeWriter(subtitle, originalText, 150), 2000);
  }
});

// === Counter Animation for Market Stats ===
function animateCounter(element, target, duration = 2000) {
  let start = 0;
  let end = target;
  let suffix = '';
  if (typeof target === 'string') {
    if (target.includes('B')) {
      end = parseFloat(target) * 1000; // e.g., 1.2B -> 1200
      suffix = 'B+';
    } else if (target.includes('$')) {
      end = parseFloat(target.replace('$', '')) * 1000;
      suffix = 'B+';
    } else if (target.includes('%')) {
      end = parseFloat(target);
      suffix = '%';
    }
  }
  const increment = end / (duration / 16);

  function updateCounter() {
    start += increment;
    if (start < end) {
      element.textContent = suffix === 'B+'
        ? (start / 1000).toFixed(1) + suffix
        : suffix === '%'
        ? Math.floor(start) + suffix
        : Math.floor(start) + '+';
      requestAnimationFrame(updateCounter);
    } else {
      element.textContent = target;
    }
  }
  updateCounter();
}

const marketObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const stats = entry.target.querySelectorAll('.market-stat');
      stats.forEach(stat => {
        const text = stat.textContent;
        if (text.includes('1.2B')) {
          animateCounter(stat, '1.2B+', 2000);
        } else if (text.includes('$25B')) {
          animateCounter(stat, '$25B+', 2000);
        } else if (text.includes('18')) {
          animateCounter(stat, '18%', 1500);
        }
      });
      marketObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.addEventListener('DOMContentLoaded', () => {
  const marketSection = document.querySelector('.market');
  if (marketSection) {
    marketObserver.observe(marketSection);
  }
});

// === Smooth Scrolling for Anchor Links ===
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
});

// === Easter Egg for Logo Clicks ===
let clickCount = 0;
document.addEventListener('DOMContentLoaded', () => {
  const logo = document.querySelector('.navbar-brand.logo');
  if (logo) {
    logo.addEventListener('click', () => {
      clickCount++;
      if (clickCount === 5) {
        alert('🛡️ You found the secret! Vigilia team says: "Stay safe out there!" 🛡️');
        clickCount = 0;
      }
    });
  }
});

// === Share Article Function ===
function shareArticle(url, title) {
  if (navigator.share) {
    navigator.share({ title, url }).catch(error => {
      console.error('Error sharing article:', error);
      alert('Sharing failed. Please copy the link manually.');
    });
  } else {
    navigator.clipboard.writeText(url).then(() => {
      alert(`Link to "${title}" copied to clipboard!`);
    }).catch(error => {
      console.error('Error copying link:', error);
      alert('Copying failed. Please copy the link manually.');
    });
  }
}

// === Chatbot Functionality ===
document.addEventListener('DOMContentLoaded', () => {
  // Inject Chatbot HTML (only if not already present)
  if (!document.querySelector('.chatbot-container')) {
    const chatbotHTML = `
      <div class="chatbot-container">
        <button class="chatbot-toggle" aria-label="Open Vigilia AI Chatbot">🤖</button>
        <div class="chatbot-window" id="chatbotWindow">
          <div class="chatbot-header">
            <span>Vigilia AI Assistant</span>
            <button class="chatbot-close" aria-label="Close Chatbot">✕</button>
          </div>
          <div class="chatbot-quick-actions">
            <button class="chatbot-quick-action" data-action="sos">Emergency SOS</button>
            <button class="chatbot-quick-action" data-action="safety-tips">Safety Tips</button>
            <button class="chatbot-quick-action" data-action="mental-health">Mental Health</button>
            <button class="chatbot-quick-action" data-action="offline-mode">Offline Mode</button>
            <button class="chatbot-quick-action" data-action="ar-navigation">AR Navigation</button>
            <button class="chatbot-quick-action" data-action="blockchain-vault">Blockchain Vault</button>
          </div>
          <div class="chatbot-body" id="chatbotBody">
            <div class="chatbot-message bot">
              <div class="message-content">Welcome to Vigilia’s AI Assistant! How can I help you stay safe today?</div>
            </div>
          </div>
          <div class="chatbot-input">
            <input type="text" id="chatbotInput" placeholder="Ask about safety, mental health, or more..." aria-label="Chatbot input" />
            <button class="chatbot-voice" aria-label="Voice input">🎙️</button>
            <button type="submit" aria-label="Send message">➤</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatbotHTML);
  }

  // Initialize Chatbot
  const chatbotToggle = document.querySelector('.chatbot-toggle');
  const chatbotWindow = document.getElementById('chatbotWindow');
  const chatbotClose = document.querySelector('.chatbot-close');
  const chatbotInput = document.getElementById('chatbotInput');
  const chatbotBody = document.getElementById('chatbotBody');
  const chatbotVoice = document.querySelector('.chatbot-voice');
  const quickActions = document.querySelectorAll('.chatbot-quick-action');

  if (!chatbotToggle || !chatbotWindow || !chatbotInput || !chatbotBody) return;

  // Toggle Chatbot Window
  chatbotToggle.addEventListener('click', () => {
    chatbotWindow.classList.toggle('open');
    if (chatbotWindow.classList.contains('open')) {
      chatbotInput.focus();
    }
  });

  chatbotClose.addEventListener('click', () => {
    chatbotWindow.classList.remove('open');
  });

  // Handle Quick Actions
  quickActions.forEach(action => {
    action.addEventListener('click', () => {
      const actionType = action.getAttribute('data-action');
      handleQuickAction(actionType);
    });
  });

  // Handle Text Input
  chatbotInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatbotInput.value.trim()) {
      addMessage('user', chatbotInput.value);
      handleUserMessage(chatbotInput.value);
      chatbotInput.value = '';
    }
  });

  // Handle Send Button
  document.querySelector('.chatbot-input button[type="submit"]').addEventListener('click', () => {
    if (chatbotInput.value.trim()) {
      addMessage('user', chatbotInput.value);
      handleUserMessage(chatbotInput.value);
      chatbotInput.value = '';
    }
  });

  // Handle Voice Input
  let recognition = null;
  if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    chatbotVoice.addEventListener('click', () => {
      recognition.start();
      chatbotVoice.style.background = 'var(--accent-color)';
    });

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      addMessage('user', transcript);
      handleUserMessage(transcript);
      chatbotVoice.style.background = 'var(--secondary-color)';
    };

    recognition.onerror = (error) => {
      console.error('Speech recognition error:', error);
      addMessage('bot', 'Sorry, I couldn’t understand your voice input. Please try typing.');
      chatbotVoice.style.background = 'var(--secondary-color)';
    };

    recognition.onend = () => {
      chatbotVoice.style.background = 'var(--secondary-color)';
    };
  } else {
    chatbotVoice.style.display = 'none';
  }

  // Add Message to Chatbot Body
  function addMessage(sender, text) {
    const message = document.createElement('div');
    message.className = `chatbot-message ${sender}`;
    message.innerHTML = `<div class="message-content">${text}</div>`;
    chatbotBody.appendChild(message);
    chatbotBody.scrollTop = chatbotBody.scrollHeight;
  }

  // Handle User Message
  function handleUserMessage(message) {
    const lowerMessage = message.toLowerCase();
    let response = '';

    if (lowerMessage.includes('emergency') || lowerMessage.includes('sos')) {
      response = 'In an emergency, activate Vigilia’s SOS feature for instant alerts to your contacts and emergency services. Would you like to know how to set it up?';
    } else if (lowerMessage.includes('safety tips') || lowerMessage.includes('safe')) {
      response = 'Here are some safety tips: Always share your location with trusted contacts, use Vigilia’s AR navigation for safe routes, and enable offline mode in low-connectivity areas. Want more specific tips?';
    } else if (lowerMessage.includes('mental health') || lowerMessage.includes('stress')) {
      response = 'Vigilia offers mental health support through guided exercises and access to professionals. Try our AI chatbot’s calming prompts or connect to a counselor. Need a quick stress-relief tip?';
    } else if (lowerMessage.includes('offline mode')) {
      response = 'Vigilia’s Offline Mode lets you access SOS alerts and safety features without internet. Ensure it’s enabled in settings for rural areas. Want setup instructions?';
    } else if (lowerMessage.includes('ar navigation') || lowerMessage.includes('navigation')) {
      response = 'Our AR Safe Navigation guides you through safe routes using augmented reality. Open the app, enable AR mode, and follow the overlays. Need help activating it?';
    } else if (lowerMessage.includes('blockchain') || lowerMessage.includes('evidence') || lowerMessage.includes('vault')) {
      response = 'The Blockchain Evidence Vault securely stores incident records for legal protection. Upload evidence via the app, and it’s encrypted on a tamper-proof ledger. Want to learn more?';
    } else if (lowerMessage.includes('travel') || lowerMessage.includes('destination')) {
      response = 'Vigilia’s Travel Safety Companion offers destination-specific tips and cross-border SOS. Enter your destination in the app for tailored advice. Need travel safety tips?';
    } else if (lowerMessage.includes('health') || lowerMessage.includes('wearable')) {
      response = 'Sync Vigilia with wearables for real-time health monitoring and panic button alerts. Check the app settings to connect your device. Need help with setup?';
    } else {
      response = 'I’m here to help with safety, mental health, or app features! Could you clarify or try a quick action like "Safety Tips" or "Mental Health"?';
    }

    setTimeout(() => addMessage('bot', response), 500);
  }

  // Handle Quick Actions
  function handleQuickAction(action) {
    let response = '';
    switch (action) {
      case 'sos':
        response = 'To activate an emergency SOS, press the SOS button in the app or say "Emergency" to trigger it. Would you like setup instructions?';
        break;
      case 'safety-tips':
        response = 'Vigilia’s safety tips include using AR navigation for safe routes, sharing your location with trusted contacts, and enabling offline mode. Want tips for a specific scenario?';
        break;
      case 'mental-health':
        response = 'Try a quick breathing exercise: Inhale for 4 seconds, hold for 4, exhale for 4. Repeat 3 times. Need more mental health resources?';
        break;
      case 'offline-mode':
        response = 'Offline Mode ensures SOS alerts and basic features work without internet. Go to Settings > Offline Mode to enable it. Need more details?';
        break;
      case 'ar-navigation':
        response = 'AR Safe Navigation uses augmented reality to guide you through safe routes. Enable it in the app and follow the AR overlays. Need activation help?';
        break;
      case 'blockchain-vault':
        response = 'The Blockchain Evidence Vault encrypts and stores incident records securely. Access it via the app for tamper-proof legal protection. Want more details?';
        break;
      default:
        response = 'Select a quick action or type a question about safety, mental health, or app features!';
    }
    addMessage('user', action.replace(/-/g, ' ').toUpperCase());
    setTimeout(() => addMessage('bot', response), 500);
  }
});

// === Console Message for Developers ===
console.log(`
🛡️ VIGILIA - YOUR DIGITAL GUARDIAN 🛡️

Thanks for checking out our code!
We're always looking for talented developers.

Interested in joining our mission to make the world safer?
Email us: team@vigilia.co.ke

Built with ❤️ by Arybit Technologies
`);