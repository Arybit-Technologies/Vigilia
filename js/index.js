// Loading screen
window.addEventListener('load', function() {
  setTimeout(() => {
    document.getElementById('loading').classList.add('fade-out');
    setTimeout(() => {
      document.getElementById('loading').style.display = 'none';
    }, 500);
  }, 1000);
});

// Toggle mobile menu
function toggleMenu() {
  const navLinks = document.getElementById('navLinks');
  const menuBtn = document.getElementById('mobileMenuBtn');
  navLinks.classList.toggle('active');
  if (menuBtn) {
    menuBtn.innerHTML = navLinks.classList.contains('active') ? '✕' : '☰';
  }
}

// Handle download button
function handleDownload() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    alert('Vigilia will be available soon on Google Play Store and Apple App Store! We\'ll notify you when it\'s ready.');
  } else {
    alert('Desktop version coming soon! For now, Vigilia is optimized for mobile devices.');
  }
}

// Handle contact form submission
function handleContact(event) {
  event.preventDefault();
  const email = document.getElementById("email").value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert("Message sent! We’ll get back to you soon.");
    event.target.reset();
    // Add API call to send form data
  } else {
    alert("Please enter a valid email address.");
  }
}

// Handle support form submission
function handleSupport(event) {
  event.preventDefault();
  const email = document.getElementById("email").value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert("Support request submitted! We’ll assist you soon.");
    event.target.reset();
    // Add API call to send form data
  } else {
    alert("Please enter a valid email address.");
  }
}

// Header scroll effect
window.addEventListener('scroll', function() {
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

// Smooth scroll to top
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// Animate on scroll
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, observerOptions);

// Observe all animate-on-scroll elements
document.addEventListener('DOMContentLoaded', function() {
  const animateElements = document.querySelectorAll('.animate-on-scroll');
  animateElements.forEach(el => observer.observe(el));
});

// Toggle FAQ answers (only one open at a time)
function toggleFAQ(button) {
  document.querySelectorAll('.faq-question').forEach(q => {
    if (q !== button) {
      q.classList.remove('active');
      q.setAttribute('aria-expanded', 'false');
      if (q.querySelector('.faq-icon')) q.querySelector('.faq-icon').textContent = '▼';
      if (q.nextElementSibling) q.nextElementSibling.classList.remove('active');
    }
  });
  const answer = button.nextElementSibling;
  const icon = button.querySelector(".faq-icon");
  const isActive = button.classList.contains('active');
  button.classList.toggle('active');
  button.setAttribute('aria-expanded', String(!isActive));
  answer.classList.toggle('active');
  if (icon) icon.textContent = isActive ? "▼" : "▲";
}

// Initialize FAQs (close all on load)
document.querySelectorAll(".faq-item").forEach((item) => {
  const answer = item.querySelector(".faq-answer");
  if (answer) answer.classList.remove("active");
  const question = item.querySelector(".faq-question");
  if (question) {
    question.setAttribute('aria-expanded', 'false');
    if (question.querySelector('.faq-icon')) question.querySelector('.faq-icon').textContent = '▼';
  }
});

// Newsletter form handler
function handleNewsletter(event) {
  event.preventDefault();
  const email = document.getElementById('emailInput').value;
  
  // Simulate API call
  setTimeout(() => {
    alert(`Thank you for subscribing! We'll send safety updates to ${email}`);
    document.getElementById('emailInput').value = '';
  }, 500);
}

// Download button handler
function handleDownload() {
  // Check if mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // For demo purposes, show coming soon message
    alert('📱 Vigilia will be available soon on Google Play Store and Apple App Store! We\'ll notify you when it\'s ready.');
  } else {
    // For desktop, could redirect to web app
    alert('💻 Desktop version coming soon! For now, Vigilia is optimized for mobile devices. We\'ll let you know when the desktop version is available.');
  }
}

// Smooth scrolling for anchor links
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

// Add some interactive particles effect to hero section
function createParticle() {
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
  
  particle.style.left = Math.random() * 100 + '%';
  particle.style.top = '100%';
  particle.style.animationDelay = Math.random() * 15 + 's';
  
  document.querySelector('.hero').appendChild(particle);
  
  setTimeout(() => {
    particle.remove();
  }, 15000);
}

// Create particles periodically
setInterval(createParticle, 2000);

// Add particle animation CSS
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

// Add typing effect for hero subtitle
function typeWriter(element, text, speed = 100) {
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

// Initialize typing effect after page load
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    const subtitle = document.querySelector('.hero-subtitle');
    if (subtitle) {
      const originalText = subtitle.textContent;
      typeWriter(subtitle, originalText, 150);
    }
  }, 2000);
});

// Add counter animation for market stats
function animateCounter(element, target, duration = 2000) {
  // Only animate numbers, not B or $ or %
  let start = 0;
  let end = target;
  let suffix = '';
  if (typeof target === 'string') {
    if (target.includes('B')) {
      end = parseFloat(target) * 1000; // 1.2B -> 1200 (for animation)
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

// Trigger counter animations when market section is visible
const marketObserver = new IntersectionObserver(function(entries) {
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

document.addEventListener('DOMContentLoaded', function() {
  const marketSection = document.querySelector('.market');
  if (marketSection) {
    marketObserver.observe(marketSection);
  }
});

// Add some easter eggs for fun
let clickCount = 0;
document.querySelector('.logo').addEventListener('click', function() {
  clickCount++;
  if (clickCount === 5) {
    alert('🛡️ You found the secret! Vigilia team says: "Stay safe out there!" 🛡️');
    clickCount = 0;
  }
});

// Console message for developers
console.log(`
🛡️ VIGILIA - YOUR DIGITAL GUARDIAN 🛡️

Thanks for checking out our code!
We're always looking for talented developers.

Interested in joining our mission to make the world safer?
Email us: team@vigilia.com

Built with ❤️ by Arybit Technologies
`);
