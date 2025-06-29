// Loading Screen
window.addEventListener('load', function () {
  const loading = document.getElementById('loading');
  setTimeout(() => {
    loading.classList.add('fade-out');
    setTimeout(() => {
      loading.style.display = 'none';
    }, 500);
  }, 1000);
});

// Handle Download Button
function handleDownload() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    alert('📱 Vigilia will be available soon on Google Play Store and Apple App Store! We\'ll notify you when it\'s ready.');
  } else {
    alert('💻 Desktop version coming soon! For now, Vigilia is optimized for mobile devices.');
  }
}

// Handle Newsletter Form Submission
function handleNewsletter(event) {
  event.preventDefault();
  const emailInput = document.getElementById('emailInput');
  const email = emailInput.value;

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setTimeout(() => {
      alert(`Thank you for subscribing! We'll send safety updates to ${email}`);
      emailInput.value = '';
    }, 500);
  } else {
    alert('Please enter a valid email address.');
  }
}

// Header Scroll Effect
window.addEventListener('scroll', function () {
  const header = document.getElementById('header');
  const scrollTop = document.getElementById('scrollTop');

  if (window.scrollY > 100) {
    header.classList.add('scrolled');
    scrollTop.classList.add('visible');
  } else {
    header.classList.remove('scrolled');
    scrollTop.classList.remove('visible');
  }
});

// Smooth Scroll to Top
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// Animate on Scroll
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function (entries) {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      // Optionally unobserve after animation to improve performance
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.addEventListener('DOMContentLoaded', function () {
  const animateElements = document.querySelectorAll('.animate-on-scroll');
  animateElements.forEach(el => observer.observe(el));
});

// Particle Effect for Hero Section
function createParticle() {
  const hero = document.querySelector('.hero');
  if (!hero) return; // Skip if not on the main page

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
  `;
  particle.style.left = `${Math.random() * 100}%`;
  particle.style.top = '100%';
  particle.style.animationDelay = `${Math.random() * 15}s`;

  hero.appendChild(particle);

  setTimeout(() => {
    particle.remove();
  }, 15000);
}

// Add Particle Animation CSS
document.addEventListener('DOMContentLoaded', function () {
  const particleStyle = document.createElement('style');
  particleStyle.textContent = `
    @keyframes particleFloat {
      0% {
        transform: translateY(0) rotate(0deg);
        opacity: 0;
      }
      10% {
        opacity: 1;
      }
      90% {
        opacity: 1;
      }
      100% {
        transform: translateY(-100vh) rotate(360deg);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(particleStyle);

  // Start particles only if hero section exists (main page)
  if (document.querySelector('.hero')) {
    setInterval(createParticle, 2000);
  }
});

// Typing Effect for Hero Subtitle
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

document.addEventListener('DOMContentLoaded', function () {
  const subtitle = document.querySelector('.hero-subtitle');
  if (subtitle) {
    const originalText = subtitle.textContent;
    setTimeout(() => typeWriter(subtitle, originalText, 150), 2000);
  }
});

// Counter Animation for Market Stats
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
      if (suffix === 'B+') {
        element.textContent = (start / 1000).toFixed(1) + suffix;
      } else if (suffix === '%') {
        element.textContent = Math.floor(start) + suffix;
      } else {
        element.textContent = Math.floor(start) + '+';
      }
      requestAnimationFrame(updateCounter);
    } else {
      element.textContent = target;
    }
  }

  updateCounter();
}

const marketObserver = new IntersectionObserver(function (entries) {
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

document.addEventListener('DOMContentLoaded', function () {
  const marketSection = document.querySelector('.market');
  if (marketSection) {
    marketObserver.observe(marketSection);
  }
});

// Smooth Scrolling for Anchor Links
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
});

// Easter Egg for Logo Clicks
let clickCount = 0;
document.addEventListener('DOMContentLoaded', function () {
  const logo = document.querySelector('.navbar-brand.logo');
  if (logo) {
    logo.addEventListener('click', function () {
      clickCount++;
      if (clickCount === 5) {
        alert('🛡️ You found the secret! Vigilia team says: "Stay safe out there!" 🛡️');
        clickCount = 0;
      }
    });
  }
});

// Share Article Function
function shareArticle(url, title) {
  if (navigator.share) {
    navigator.share({
      title: title,
      url: url
    }).catch(error => {
      console.error('Error sharing article:', error);
      alert('Sharing failed. Please copy the link manually.');
    });
  } else {
    // Fallback for browsers that don't support Web Share API
    navigator.clipboard.writeText(url).then(() => {
      alert(`Link to "${title}" copied to clipboard!`);
    }).catch(error => {
      console.error('Error copying link:', error);
      alert('Copying failed. Please copy the link manually.');
    });
  }
}

// Console Message for Developers
console.log(`
🛡️ VIGILIA - YOUR DIGITAL GUARDIAN 🛡️

Thanks for checking out our code!
We're always looking for talented developers.

Interested in joining our mission to make the world safer?
Email us: team@vigilia.com

Built with ❤️ by Arybit Technologies
`);