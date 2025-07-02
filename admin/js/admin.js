// Constants
const API_URL = 'https://arybit.x10.mx/api/';
const CACHE_KEY = 'vigilia_dashboard_cache';
const DEFAULT_TIMEFRAME = '12m';
const MAX_LOG_ENTRIES = 100;

// Data Stores
let dailyData = [];
let forecastData = [];
let metricsConfig = [];
let selectedView = 'overview';
let chartInstances = {};

/**
 * Formats a number as USD currency.
 * @param {number} value - The value to format.
 * @returns {string} Formatted currency string.
 */
const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return '$0';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
};

/**
 * Formats a number with commas.
 * @param {number} value - The value to format.
 * @returns {string} Formatted number string.
 */
const formatNumber = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return '0';
    return new Intl.NumberFormat('en-US').format(value);
};

/**
 * Parses a percentage string to a number.
 * @param {string} str - The percentage string (e.g., '50%').
 * @returns {number|null} Parsed percentage or null if invalid.
 */
const parsePercentage = (str) => {
    if (!str || str === '–') return null;
    const value = parseFloat(str.replace('%', ''));
    return isNaN(value) ? null : value;
};

/**
 * Determines status indicator based on metric value and thresholds.
 * @param {number|string} current - Current metric value.
 * @param {Object} config - Metric configuration with thresholds.
 * @returns {Object} Status object with class, text, and emoji.
 */
const getStatusIndicator = (current, config) => {
    const currentNum = config.format === 'percentage' ? parsePercentage(current) : Number(current);
    if (currentNum === null) return { class: 'status-warning', text: 'No Data', emoji: '⚠️' };
    return currentNum >= config.threshold.good
        ? { class: 'status-excellent', text: 'Excellent', emoji: '🚀' }
        : currentNum >= config.threshold.warning
            ? { class: 'status-good', text: 'Good', emoji: '✅' }
            : { class: 'status-danger', text: 'Poor', emoji: '⚠️' };
};

/**
 * Toggles between light and dark themes.
 */
const toggleTheme = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.querySelector('.theme-toggle').textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    console.log(`Theme toggled to ${isDark ? 'dark' : 'light'} mode`);
};

/**
 * Renders the selected view (overview, revenue, financing).
 * @param {string} view - The view to render.
 */
const renderView = (view) => {
    selectedView = view;
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === view);
        tab.classList.toggle('btn-primary', tab.dataset.view === view);
        tab.classList.toggle('btn-outline-primary', tab.dataset.view !== view);
        tab.setAttribute('aria-selected', tab.dataset.view === view);
    });
    ['overview-section', 'revenue-section', 'financing-section'].forEach(section => {
        document.getElementById(section).style.display = section === `${view}-section` ? 'block' : 'none';
    });
    updateAllViews();
    console.log(`Switched to ${view} view`);
};

/**
 * Updates metric cards with latest data.
 */
const updateMetricCards = () => {
    const finalMetrics = forecastData[forecastData.length - 1] || {};
    const initialMetrics = forecastData[0] || {};
    const latestData = dailyData[dailyData.length - 1] || {};
    const growthMetrics = {
        userGrowth: initialMetrics.users ? ((finalMetrics.users - initialMetrics.users) / initialMetrics.users * 100) : 0
    };

    const metrics = [
        {
            id: 'total-users',
            title: 'Total Users',
            value: formatNumber(finalMetrics.users || 0),
            icon: '<i class="fas fa-users fa-2x text-blue-500"></i>',
            footer: `+${growthMetrics.userGrowth.toFixed(0)}% growth`,
            color: 'blue'
        },
        {
            id: 'total-daus',
            title: 'Daily Active Users',
            value: formatNumber(latestData.daus || 0),
            icon: '<i class="fas fa-user-check fa-2x text-green-500"></i>',
            footer: latestData.daus && dailyData[dailyData.length - 2]?.daus < latestData.daus ? '↗️ Up' : '↘️ Down',
            color: 'green'
        },
        {
            id: 'total-revenue',
            title: 'Total Revenue',
            value: formatCurrency((finalMetrics.pro || 0) + (finalMetrics.family || 0)),
            icon: '<i class="fas fa-dollar-sign fa-2x text-purple-500"></i>',
            footer: '30-month projection',
            color: 'purple'
        },
        {
            id: 'app-rating',
            title: 'App Store Rating',
            value: (latestData.rating || 0).toFixed(1),
            icon: '<i class="fas fa-star fa-2x text-orange-500"></i>',
            footer: latestData.rating >= 4 ? '↗️ Strong' : '↘️ Needs Improvement',
            color: 'orange'
        }
    ];

    metrics.forEach(metric => {
        const element = document.getElementById(metric.id);
        if (element) {
            element.innerHTML = `
                <div class="card fade-in-up" role="region" aria-label="${metric.title}">
                    <div class="card-body d-flex align-items-center justify-content-between">
                        <div>
                            <p class="text-${metric.color}-600 text-sm font-medium">${metric.title}</p>
                            <p class="text-2xl font-bold text-${metric.color}-900">${metric.value}</p>
                            <p class="text-sm text-${metric.color}-600 mt-2">${metric.footer}</p>
                        </div>
                        ${metric.icon}
                    </div>
                </div>
            `;
        }
    });
};

/**
 * Populates the metrics status table.
 */
const populateMetricsStatusTable = () => {
    const tableBody = document.querySelector('#metrics-status-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const latestData = dailyData[dailyData.length - 1] || {};
    const finalMetrics = forecastData[forecastData.length - 1] || {};

    const metrics = [
        { metric: 'User Growth', key: 'users', value: finalMetrics.users, format: 'number', threshold: { good: 1000000, warning: 500000 } },
        { ...metricsConfig.find(m => m.key === 'daus') || { metric: 'Daily Active Users', key: 'daus', value: latestData.daus, format: 'number', threshold: { good: 10000, warning: 5000 } } },
        { metric: 'Revenue (Current)', key: 'revenue', value: (finalMetrics.pro || 0) + (finalMetrics.family || 0), format: 'number', threshold: { good: 1000000, warning: 500000 } },
        { ...metricsConfig.find(m => m.key === 'rating') || { metric: 'App Rating', key: 'rating', value: latestData.rating, format: 'number', threshold: { good: 4, warning: 3 } } }
    ];

    metrics.forEach(config => {
        const status = getStatusIndicator(config.value, config);
        tableBody.innerHTML += `
            <tr>
                <td><strong>${config.metric}</strong></td>
                <td><span class="status-badge ${status.class}" role="status">${status.emoji} ${status.text}</span></td>
            </tr>
        `;
    });
};

/**
 * Initializes a Chart.js instance with common options.
 * @param {string} canvasId - Canvas element ID.
 * @param {Object} config - Chart configuration.
 * @returns {Chart|null} Chart instance or null if canvas not found.
 */
const initializeChart = (canvasId, config) => {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
    chartInstances[canvasId] = new Chart(ctx, config);
    return chartInstances[canvasId];
};

/**
 * Initializes the User Growth chart.
 * @param {string} timeframe - Timeframe for data ('7d', '30d', '90d').
 */
const initializeUserGrowthChart = (timeframe = '7d') => {
    const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
    const filteredData = dailyData.slice(-days);

    initializeChart('appPerformanceChart', {
        type: 'line',
        data: {
            labels: filteredData.map(row => new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            datasets: [
                {
                    label: 'Daily Active Users',
                    data: filteredData.map(row => row.daus || 0),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#3B82F6',
                    pointBorderColor: '#FFFFFF'
                },
                {
                    label: 'Daily Installs',
                    data: filteredData.map(row => row.installs || 0),
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#10B981',
                    pointBorderColor: '#FFFFFF'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 12 }, boxWidth: 10 } },
                tooltip: {
                    backgroundColor: 'rgba(59, 130, 246, 0.9)',
                    titleFont: { size: 12 },
                    bodyFont: { size: 12 },
                    callbacks: { label: context => `${context.dataset.label}: ${formatNumber(context.parsed.y)}` }
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: value => formatNumber(value), font: { size: 11 } } },
                x: { ticks: { font: { size: 11 }, maxRotation: 45, minRotation: 45 } }
            },
            accessibility: {
                enabled: true,
                description: 'Line chart showing daily active users and installs over time'
            }
        }
    });
};

/**
 * Initializes the Cash Flow chart.
 * @param {string} timeframe - Timeframe for data ('12m', '24m', '30m').
 */
const initializeCashFlowChart = (timeframe = DEFAULT_TIMEFRAME) => {
    const months = timeframe === '12m' ? 12 : timeframe === '24m' ? 24 : 30;
    const filteredData = forecastData.filter(row => row.month <= months);

    initializeChart('financialChart', {
        type: 'line',
        data: {
            labels: filteredData.map(row => `Month ${row.month}`),
            datasets: [
                {
                    label: 'Monthly Cash Flow',
                    data: filteredData.map(row => row.cashFlow || 0),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y-left'
                },
                {
                    label: 'Total Users',
                    data: filteredData.map(row => row.users || 0),
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y-right'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 12 }, boxWidth: 10 } },
                tooltip: {
                    backgroundColor: 'rgba(59, 130, 246, 0.9)',
                    titleFont: { size: 12 },
                    bodyFont: { size: 12 },
                    callbacks: {
                        label: context => context.dataset.label === 'Monthly Cash Flow'
                            ? `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`
                            : `${context.dataset.label}: ${formatNumber(context.parsed.y)}`
                    }
                }
            },
            scales: {
                'y-left': { position: 'left', ticks: { callback: value => formatCurrency(value), font: { size: 11 } } },
                'y-right': { position: 'right', ticks: { callback: value => formatNumber(value), font: { size: 11 } } },
                x: { ticks: { font: { size: 11 } } }
            }
        }
    });
};

/**
 * Initializes the Revenue chart.
 * @param {string} timeframe - Timeframe for data ('12m', '24m', '30m').
 */
const initializeRevenueChart = (timeframe = DEFAULT_TIMEFRAME) => {
    const months = timeframe === '12m' ? 12 : timeframe === '24m' ? 24 : 30;
    const filteredData = forecastData.filter(row => row.month <= months);

    initializeChart('revenueChart', {
        type: 'line',
        data: {
            labels: filteredData.map(row => `Month ${row.month}`),
            datasets: [
                {
                    label: 'Pro Revenue',
                    data: filteredData.map(row => row.pro || 0),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Family Revenue',
                    data: filteredData.map(row => row.family || 0),
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 12 }, boxWidth: 10 } },
                tooltip: {
                    backgroundColor: 'rgba(59, 130, 246, 0.9)',
                    titleFont: { size: 12 },
                    bodyFont: { size: 12 },
                    callbacks: { label: context => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}` }
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: value => formatCurrency(value), font: { size: 11 } } },
                x: { ticks: { font: { size: 11 } } }
            }
        }
    });
};

/**
 * Initializes the Subscription Revenue bar chart.
 */
const initializeSubscriptionRevenueChart = () => {
    const filteredData = forecastData.slice(-12);

    initializeChart('subscriptionRevenueChart', {
        type: 'bar',
        data: {
            labels: filteredData.map(row => `Month ${row.month}`),
            datasets: [
                {
                    label: 'Pro Revenue',
                    data: filteredData.map(row => row.pro || 0),
                    backgroundColor: '#3B82F6',
                    borderColor: '#3B82F6',
                    borderWidth: 1
                },
                {
                    label: 'Family Revenue',
                    data: filteredData.map(row => row.family || 0),
                    backgroundColor: '#10B981',
                    borderColor: '#10B981',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 12 }, boxWidth: 10 } },
                tooltip: {
                    backgroundColor: 'rgba(59, 130, 246, 0.9)',
                    titleFont: { size: 12 },
                    bodyFont: { size: 12 },
                    callbacks: { label: context => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}` }
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: value => formatCurrency(value), font: { size: 11 } } },
                x: { ticks: { font: { size: 11 }, maxRotation: 45, minRotation: 45 } }
            }
        }
    });
};

/**
 * Initializes the Subscription Pie chart.
 */
const initializeSubscriptionPieChart = () => {
    const finalMetrics = forecastData[forecastData.length - 1] || {};
    const subscriptionData = [
        { name: 'Pro Users', value: finalMetrics.pro || 0, color: '#3B82F6' },
        { name: 'Family Users', value: finalMetrics.family || 0, color: '#10B981' },
        { name: 'Free Users', value: (finalMetrics.users || 0) - (finalMetrics.pro || 0) - (finalMetrics.family || 0), color: '#6B7280' }
    ];

    initializeChart('subscriptionPieChart', {
        type: 'pie',
        data: {
            labels: subscriptionData.map(d => d.name),
            datasets: [{
                data: subscriptionData.map(d => d.value),
                backgroundColor: subscriptionData.map(d => d.color),
                borderColor: '#FFFFFF',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 12 }, boxWidth: 10 } },
                tooltip: {
                    backgroundColor: 'rgba(59, 130, 246, 0.9)',
                    titleFont: { size: 12 },
                    bodyFont: { size: 12 },
                    callbacks: { label: context => `${context.label}: ${formatCurrency(context.parsed)}` }
                }
            }
        }
    });
};

/**
 * Initializes the Financing chart.
 * @param {string} timeframe - Timeframe for data ('12m', '24m', '30m').
 */
const initializeFinancingChart = (timeframe = DEFAULT_TIMEFRAME) => {
    const months = timeframe === '12m' ? 12 : timeframe === '24m' ? 24 : 30;
    const filteredData = forecastData.filter(row => row.month <= months);

    initializeChart('financingChart', {
        type: 'line',
        data: {
            labels: filteredData.map(row => `Month ${row.month}`),
            datasets: [{
                label: 'Loan Capacity',
                data: filteredData.map(row => row.loanCapacity || 0),
                borderColor: '#F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 12 }, boxWidth: 10 } },
                tooltip: {
                    backgroundColor: 'rgba(245, 158, 11, 0.9)',
                    titleFont: { size: 12 },
                    bodyFont: { size: 12 },
                    callbacks: { label: context => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}` }
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: value => formatCurrency(value), font: { size: 11 } } },
                x: { ticks: { font: { size: 11 } } }
            }
        }
    });
};

/**
 * Updates financing metrics cards.
 */
const updateFinancingMetrics = () => {
    const finalMetrics = forecastData[forecastData.length - 1] || {};
    const annualRevenue = (finalMetrics.pro || 0) + (finalMetrics.family || 0);
    const metricsHtml = `
        <div class="col-md-4">
            <div class="card fade-in-up bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200" role="region" aria-label="Debt-to-Revenue Ratio">
                <div class="card-body">
                    <h4 class="text-amber-800 font-semibold mb-2">Debt-to-Revenue Ratio</h4>
                    <p class="text-2xl font-bold text-amber-900">80%</p>
                    <p class="text-sm text-amber-600 mt-1">Max annual debt payment / Annual revenue</p>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card fade-in-up bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200" role="region" aria-label="Total Financing Available">
                <div class="card-body">
                    <h4 class="text-emerald-800 font-semibold mb-2">Total Financing Available</h4>
                    <p class="text-2xl font-bold text-emerald-900">${formatCurrency(finalMetrics.loanCapacity || 0)}</p>
                    <p class="text-sm text-emerald-600 mt-1">Based on cash flow projections</p>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card fade-in-up bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200" role="region" aria-label="Monthly Debt Service">
                <div class="card-body">
                    <h4 class="text-indigo-800 font-semibold mb-2">Monthly Debt Service</h4>
                    <p class="text-2xl font-bold text-indigo-900">${formatCurrency((finalMetrics.annualCashFlow || 0) * 0.8 / 12)}</p>
                    <p class="text-sm text-indigo-600 mt-1">Max sustainable monthly payment</p>
                </div>
            </div>
        </div>
    `;
    const element = document.getElementById('financing-metrics');
    if (element) element.innerHTML = metricsHtml;
};

/**
 * Populates the subscription table.
 * @param {string} scenario - Subscription scenario ('all', 'Current Pricing', 'Projected Pricing').
 */
const populateSubscriptionTable = (scenario = 'all') => {
    const tableBody = document.getElementById('subscription-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    forecastData.forEach(row => {
        const plans = [
            { name: 'Free', users: row.users * (scenario === 'Projected Pricing' ? 0.20 : 0.84), price: 0, revenue: 0, scenario: scenario === 'all' ? 'Current Pricing' : scenario },
            { name: 'Pro', users: row.users * (scenario === 'Projected Pricing' ? 0.75 : 0.12), price: 5.99, revenue: scenario === 'Projected Pricing' ? row.projectedPro : row.pro, scenario: scenario === 'all' ? 'Current Pricing' : scenario },
            { name: 'Family', users: row.users * (scenario === 'Projected Pricing' ? 0.05 : 0.04), price: 11.99, revenue: scenario === 'Projected Pricing' ? row.projectedFamily : row.family, scenario: scenario === 'all' ? 'Current Pricing' : scenario }
        ];

        if (scenario === 'all') {
            plans.push(...plans.map(plan => ({
                ...plan,
                scenario: 'Projected Pricing',
                users: plan.name === 'Free' ? row.users * 0.20 : plan.name === 'Pro' ? row.users * 0.75 : row.users * 0.05,
                revenue: plan.name === 'Pro' ? row.projectedPro : plan.name === 'Family' ? row.projectedFamily : 0
            })));
        }

        plans.forEach(plan => {
            tableBody.innerHTML += `
                <tr>
                    <td>Month ${row.month}</td>
                    <td>${plan.scenario}</td>
                    <td>${plan.name}</td>
                    <td>${formatNumber(Math.round(plan.users))} (${((plan.users / row.users) * 100).toFixed(1)}%)</td>
                    <td>$${plan.price.toFixed(2)}</td>
                    <td>${formatCurrency(plan.revenue)}</td>
                </tr>
            `;
        });
    });
};

/**
 * Updates growth goals progress bars.
 */
const updateGrowthGoals = () => {
    const finalMetrics = forecastData[forecastData.length - 1] || {};
    const totalUsers = finalMetrics.users || 0;
    const totalRevenue = forecastData.reduce((sum, row) => sum + (row.projectedPro || 0) + (row.projectedFamily || 0), 0);
    const targetUsers6M = 250000;
    const targetUsers30M = 10000000;
    const targetRevenue = 10000000;

    const updateProgress = (id, progress, text) => {
        const bar = document.getElementById(`${id}-progress-bar`);
        const percentage = document.getElementById(`${id}-percentage`);
        const textElement = document.getElementById(`${id}-progress-text`);
        if (bar && percentage && textElement) {
            bar.style.width = `${progress}%`;
            bar.setAttribute('aria-valuenow', progress.toFixed(1));
            percentage.textContent = `${progress.toFixed(1)}%`;
            textElement.textContent = text;
        }
    };

    updateProgress('users-6m', Math.min((totalUsers / targetUsers6M) * 100, 100), `${formatNumber(totalUsers)} / 250,000 users`);
    updateProgress('users-30m', Math.min((totalUsers / targetUsers30M) * 100, 100), `${formatNumber(totalUsers)} / 10,000,000 users`);
    updateProgress('revenue', Math.min((totalRevenue / targetRevenue) * 100, 100), `${formatCurrency(totalRevenue)} / ${formatCurrency(targetRevenue)}`);
};

/**
 * Populates the daily data table.
 */
const populateDailyDataTable = () => {
    const tableBody = document.querySelector('#daily-data-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const sortedData = [...dailyData].sort((a, b) => new Date(b.date) - new Date(a.date));
    sortedData.forEach((row, index) => {
        const originalIndex = dailyData.findIndex(item => item.date === row.date);
        tableBody.innerHTML += `
            <tr class="fade-in">
                <td><strong>${new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></td>
                <td>${formatNumber(row.daus)}</td>
                <td>${formatNumber(row.installs)}</td>
                <td>${row.day1Retention}</td>
                <td>${row.day30Retention}</td>
                <td>${row.rating.toFixed(1)}</td>
                <td>${row.notes || '–'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editData(${originalIndex})" aria-label="Edit data for ${row.date}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteData(${originalIndex})" aria-label="Delete data for ${row.date}">Delete</button>
                </td>
            </tr>
        `;
    });
};

/**
 * Adds a new data entry to dailyData.
 */
const addData = () => {
    const form = document.getElementById('daily-data-form');
    if (!form) return;

    const date = form.querySelector('#date')?.value;
    const daus = parseInt(form.querySelector('#daus')?.value);
    const installs = parseInt(form.querySelector('#installs')?.value);
    const day1Retention = form.querySelector('#day1Retention')?.value;
    const day30Retention = form.querySelector('#day30Retention')?.value || '–';
    const rating = parseFloat(form.querySelector('#rating')?.value);
    const notes = form.querySelector('#notes')?.value?.replace(/[<>&"]/g, '').trim();

    if (!date || isNaN(daus) || isNaN(installs) || !day1Retention || isNaN(rating)) {
        showNotification('Please fill in all required fields', 'warning');
        return;
    }
    if (rating < 1 || rating > 5) {
        showNotification('Rating must be between 1 and 5', 'warning');
        return;
    }
    if (daus < 0 || installs < 0) {
        showNotification('DAUs and Installs must be non-negative', 'warning');
        return;
    }
    if (parsePercentage(day1Retention) < 0 || parsePercentage(day1Retention) > 100) {
        showNotification('Day 1 Retention must be between 0% and 100%', 'warning');
        return;
    }
    if (day30Retention !== '–' && (parsePercentage(day30Retention) < 0 || parsePercentage(day30Retention) > 100)) {
        showNotification('Day 30 Retention must be between 0% and 100%', 'warning');
        return;
    }
    if (dailyData.find(item => item.date === date)) {
        showNotification('Data for this date already exists', 'warning');
        return;
    }

    dailyData.push({ date, daus, installs, day1Retention, day30Retention, rating, notes });
    dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));
    updateAllViews();
    resetForm();
    showNotification('Data added successfully', 'success');
    console.log(`Added data for ${date}: DAUs=${daus}, Installs=${installs}, Rating=${rating}`);
};

/**
 * Edits an existing data entry.
 * @param {number} index - Index of the data entry.
 */
const editData = (index) => {
    const row = dailyData[index];
    if (!row) return;

    const form = document.getElementById('daily-data-form');
    if (form) {
        form.querySelector('#date').value = row.date;
        form.querySelector('#daus').value = row.daus;
        form.querySelector('#installs').value = row.installs;
        form.querySelector('#day1Retention').value = row.day1Retention;
        form.querySelector('#day30Retention').value = row.day30Retention === '–' ? '' : row.day30Retention;
        form.querySelector('#rating').value = row.rating;
        form.querySelector('#notes').value = row.notes;
    }

    deleteData(index, false);
    form.querySelector('#date').focus();
    console.log(`Editing data for ${row.date}`);
};

/**
 * Deletes a data entry.
 * @param {number} index - Index of the data entry.
 * @param {boolean} showNotificationFlag - Whether to show a notification.
 */
const deleteData = (index, showNotificationFlag = true) => {
    const deletedDate = dailyData[index]?.date;
    if (showNotificationFlag && !confirm('Are you sure you want to delete this entry?')) return;
    dailyData.splice(index, 1);
    updateAllViews();
    if (showNotificationFlag) {
        showNotification('Data deleted successfully', 'warning');
        console.log(`Deleted data for ${deletedDate}`);
    }
};

/**
 * Resets the daily data form.
 */
const resetForm = () => {
    const form = document.getElementById('daily-data-form');
    if (form) {
        form.reset();
        setTodaysDate();
        console.log('Form reset');
    }
};

/**
 * Updates the activity feed with recent data.
 */
const updateActivityFeed = () => {
    const feed = document.getElementById('activity-feed');
    if (!feed) return;
    feed.innerHTML = '';
    const recentData = dailyData.slice(-5).reverse();
    recentData.forEach(row => {
        feed.innerHTML += `<div class="mb-2 fade-in" role="log"><small class="text-muted">${new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: ${row.notes || 'No notes'} (DAUs: ${formatNumber(row.daus)})</small></div>`;
    });
};

/**
 * Exports app data as CSV.
 */
const exportAppData = () => {
    const csv = [
        ['Date', 'DAUs', 'Installs', 'Day 1 Retention', 'Day 30 Retention', 'Rating', 'Notes'],
        ...dailyData.map(row => [
            row.date,
            row.daus,
            row.installs,
            row.day1Retention,
            row.day30Retention,
            row.rating,
            `"${row.notes.replace(/"/g, '""')}"`
        ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vigilia_app_data.csv';
    a.click();
    URL.revokeObjectURL(url);
    showNotification('App data exported successfully', 'success');
    console.log('Exported app data to CSV');
};

/**
 * Exports financial data as CSV.
 */
const exportFinancialData = () => {
    const csv = [
        ['Month', 'Users', 'Cash Flow ($/month)', 'Current Revenue', 'Projected Revenue', 'Loan Capacity'],
        ...forecastData.map(row => [
            row.month,
            row.users,
            row.cashFlow,
            (row.pro || 0) + (row.family || 0),
            (row.projectedPro || 0) + (row.projectedFamily || 0),
            row.loanCapacity
        ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vigilia_financial_data.csv';
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Financial data exported successfully', 'success');
    console.log('Exported financial data to CSV');
};

/**
 * Shows a notification message.
 * @param {string} message - The message to display.
 * @param {string} type - Notification type ('success', 'warning', 'danger').
 */
const showNotification = (message, type = 'success') => {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show`;
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1050;';
    notification.innerHTML = `
        <strong>${type.charAt(0).toUpperCase() + type.slice(1)}:</strong> ${message.replace(/[<>&]/g, '')}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.remove('show'), 3000);
    setTimeout(() => notification.remove(), 3300);
    console[type === 'success' ? 'log' : type === 'warning' ? 'warn' : 'error'](`Notification: ${message}`);
};

/**
 * Calculates piecewise growth model.
 * @param {Object} params - Growth parameters.
 * @returns {number[]} Array of user counts.
 */
const calculatePiecewiseGrowth = ({ months, rollout, exp_start, exp_rate }) => {
    const users = [];
    for (let i = 0; i < months; i++) {
        if (i < rollout.length) {
            users.push(rollout[i]);
        } else {
            const prevUsers = users[i - 1] || exp_start;
            users.push(Math.round(prevUsers * (1 + exp_rate)));
        }
    }
    return users;
};

/**
 * Calculates linear growth model.
 * @param {Object} params - Growth parameters.
 * @returns {number[]} Array of user counts.
 */
const calculateLinearGrowth = ({ months, linear_growth }) => {
    const users = [];
    let currentUsers = 0;
    for (let i = 0; i < months; i++) {
        currentUsers += linear_growth;
        users.push(Math.round(currentUsers));
    }
    return users;
};

/**
 * Calculates polynomial growth model.
 * @param {Object} params - Growth parameters.
 * @returns {number[]} Array of user counts.
 */
const calculatePolynomialGrowth = ({ months, a, b, c }) => {
    const users = [];
    for (let i = 1; i <= months; i++) {
        users.push(Math.round(a * i * i + b * i + c));
    }
    return users;
};

/**
 * Calculates logistic growth model.
 * @param {Object} params - Growth parameters.
 * @returns {number[]} Array of user counts.
 */
const calculateLogisticGrowth = ({ months, L, k, t0 }) => {
    const users = [];
    for (let i = 1; i <= months; i++) {
        users.push(Math.round(L / (1 + Math.exp(-k * (i - t0)))));
    }
    return users;
};

/**
 * Calculates exponential growth model.
 * @param {Object} params - Growth parameters.
 * @returns {number[]} Array of user counts.
 */
const calculateExponentialGrowth = ({ months, exp_start, exp_rate }) => {
    const users = [];
    let currentUsers = exp_start;
    for (let i = 0; i < months; i++) {
        users.push(Math.round(currentUsers));
        currentUsers *= (1 + exp_rate);
    }
    return users;
};

/**
 * Validates growth model parameters.
 * @param {Object} params - Growth parameters.
 * @returns {boolean} True if valid, false otherwise.
 */
const validateParams = (params) => {
    const errors = [];
    if (!Number.isInteger(params.months) || params.months < 1 || params.months > 60) {
        errors.push('Months must be an integer between 1 and 60.');
    }
    if (params.model_type === 'piecewise') {
        if (!Array.isArray(params.rollout) || params.rollout.length !== 6 || params.rollout.some(isNaN)) {
            errors.push('Rollout must contain exactly 6 valid numbers.');
        }
        if (params.exp_start <= 0) errors.push('Exponential start must be positive.');
        if (params.exp_rate <= 0 || params.exp_rate > 1) errors.push('Exponential rate must be between 0 and 1.');
    } else if (params.model_type === 'linear') {
        if (params.linear_growth <= 0) errors.push('Linear growth must be positive.');
    } else if (params.model_type === 'polynomial') {
        if (isNaN(params.a) || isNaN(params.b) || isNaN(params.c)) errors.push('Polynomial coefficients (a, b, c) must be valid numbers.');
    } else if (params.model_type === 'logistic') {
        if (params.L <= 0) errors.push('Carrying capacity (L) must be positive.');
        if (params.k <= 0 || params.k > 1) errors.push('Logistic growth rate (k) must be between 0 and 1.');
        if (params.t0 < 0) errors.push('Logistic midpoint (t₀) must be non-negative.');
    } else if (params.model_type === 'exponential') {
        if (params.exp_start <= 0) errors.push('Exponential start must be positive.');
        if (params.exp_rate <= 0 || params.exp_rate > 1) errors.push('Exponential rate must be between 0 and 1.');
    }
    if (params.revA_pro < 0 || params.revA_pro > 1) errors.push('Pro % (Current) must be between 0 and 1.');
    if (params.revA_family < 0 || params.revA_family > 1) errors.push('Family % (Current) must be between 0 and 1.');
    if (params.revB_pro < 0 || params.revB_pro > 1) errors.push('Pro % (Projected) must be between 0 and 1.');
    if (params.revB_family < 0 || params.revB_family > 1) errors.push('Family % (Projected) must be between 0 and 1.');
    if (params.cf_start < 0) errors.push('Cash flow start must be non-negative.');
    if (params.cf_step < 0) errors.push('Cash flow step must be non-negative.');
    if (params.price_pro <= 0) errors.push('Pro subscription price must be positive.');
    if (params.price_family <= 0) errors.push('Family subscription price must be positive.');

    if (errors.length > 0) {
        showNotification(errors.join(' '), 'danger');
        return false;
    }
    return true;
};

/**
 * Fetches dashboard data from API or cache.
 */
const fetchDashboardData = async () => {
    const submitButton = document.querySelector('#growth-params-form button[type="submit"]');
    const selectedModel = document.getElementById('growthModel')?.value;
    if (!selectedModel || !submitButton) return;

    const getInputValue = (id, defaultValue) => {
        const value = document.getElementById(id)?.value;
        return value ? (id === 'rollout' ? value.split(',').map(Number) : Number(value)) : defaultValue;
    };

    const params = {
        model_type: selectedModel,
        months: getInputValue('months', 30),
        rollout: getInputValue('rollout', [7500, 22500, 45000, 50000, 65000, 60000]),
        linear_growth: getInputValue('linear_growth', 58333),
        exp_start: getInputValue('exp_start', 60000),
        exp_rate: getInputValue('exp_rate', 0.15),
        a: getInputValue('a', 1000),
        b: getInputValue('b', 30000),
        c: getInputValue('c', 0),
        L: getInputValue('L', 1000000),
        k: getInputValue('k', 0.3),
        t0: getInputValue('t0', 12),
        revA_pro: getInputValue('revA_pro', 0.12),
        revA_family: getInputValue('revA_family', 0.04),
        revB_pro: getInputValue('revB_pro', 0.75),
        revB_family: getInputValue('revB_family', 0.05),
        cf_start: getInputValue('cf_start', 15000),
        cf_step: getInputValue('cf_step', 10000),
        price_pro: getInputValue('price_pro', 5.99),
        price_family: getInputValue('price_family', 11.99),
        Pro_Users_12_perc: getInputValue('revA_pro', 0.12) * 100,
        Family_Users_4_perc: getInputValue('revA_family', 0.04) * 100,
        Pro_Users_75_perc: getInputValue('revB_pro', 0.75) * 100,
        Family_Users_5_perc: getInputValue('revB_family', 0.05) * 100,
        const_pro_12: getInputValue('const_pro_12', undefined),
        const_family_4: getInputValue('const_family_4', undefined),
        const_pro_75: getInputValue('const_pro_75', undefined),
        const_family_5: getInputValue('const_family_5', undefined)
    };

    if (!validateParams(params)) return;

    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const payload = data.data || data;
        const labels = getRevenueLabels(params);

        dailyData = (payload.daily_app_metrics || []).map(row => ({
            date: row.date,
            daus: Number(row.daus) || 0,
            installs: Number(row.installs) || 0,
            day1Retention: row.day1_retention || '–',
            day30Retention: row.day30_retention || '–',
            referralRate: row.referral_rate || '–',
            rating: Number(row.rating) || 0,
            notes: row.notes?.replace(/[<>&]/g, '') || ''
        }));

        forecastData = (payload.forecast || []).map(row => ({
            month: row.months,
            cashFlow: Number(row['Cash Flow ($/month)']) || 0,
            users: Number(row['users per month']) || 0,
            annualCashFlow: Number(row['Cash Flow ($/year)']) || 0,
            loanCapacity: Number(row['Estimated Loan Capacity ($)']) || 0,
            pro: Number(row[labels.pro_12]) || 0,
            family: Number(row[labels.family_4]) || 0,
            projectedPro: Number(row[labels.pro_75]) || 0,
            projectedFamily: Number(row[labels.family_5]) || 0
        }));

        metricsConfig = (payload.metrics_config || []).map(row => ({
            metric: row.metric,
            key: row.metric_key,
            target: row.format === 'percentage' ? parseFloat(row.target) : Number(row.target),
            format: row.format,
            threshold: {
                good: row.format === 'percentage' ? parseFloat(row.threshold_good) : Number(row.threshold_good),
                warning: row.format === 'percentage' ? parseFloat(row.threshold_warning) : Number(row.threshold_warning)
            }
        }));

        updateAllViews();
        showNotification('Dashboard data updated successfully.', 'success');
        console.log('Dashboard data fetched successfully from API');
        localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (error) {
        let errorMessage = 'Failed to load API data. Using local data.';
        if (error.message.includes('Network')) errorMessage = 'Network error: Unable to reach the API.';
        else if (error.message.includes('40')) errorMessage = 'Invalid request: Check input parameters.';
        else if (error.message.includes('50')) errorMessage = 'Server error: Please try again later.';
        showNotification(errorMessage, 'warning');
        console.error(`API fetch error: ${error.message}`);

        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            dailyData = (data.daily_app_metrics || []).map(row => ({
                date: row.date,
                daus: Number(row.daus) || 0,
                installs: Number(row.installs) || 0,
                day1Retention: row.day1_retention || '–',
                day30Retention: row.day30_retention || '–',
                referralRate: row.referral_rate || '–',
                rating: Number(row.rating) || 0,
                notes: row.notes?.replace(/[<>&]/g, '') || ''
            }));

            forecastData = (data.forecast || []).map(row => ({
                month: row.months,
                cashFlow: Number(row['Cash Flow ($/month)']) || 0,
                users: Number(row['users per month']) || 0,
                annualCashFlow: Number(row['Cash Flow ($/year)']) || 0,
                loanCapacity: Number(row['Estimated Loan Capacity ($)']) || 0,
                pro: Number(row['Pro 12% @ 5.99']) || 0,
                family: Number(row['Family 4% @ 11.99']) || 0,
                projectedPro: Number(row['Pro 75% @ 5.99']) || 0,
                projectedFamily: Number(row['Family 5% @ 11.99']) || 0
            }));

            metricsConfig = (data.metrics_config || []).map(row => ({
                metric: row.metric,
                key: row.metric_key,
                target: row.format === 'percentage' ? parseFloat(row.target) : Number(row.target),
                format: row.format,
                threshold: {
                    good: row.format === 'percentage' ? parseFloat(row.threshold_good) : Number(row.threshold_good),
                    warning: row.format === 'percentage' ? parseFloat(row.threshold_warning) : Number(row.threshold_warning)
                }
            }));

            updateAllViews();
            showNotification('Dashboard data loaded from cache.', 'info');
            console.log('Dashboard data loaded from cache');
        } else {
            const users = params.model_type === 'piecewise' ? calculatePiecewiseGrowth(params) :
                          params.model_type === 'linear' ? calculateLinearGrowth(params) :
                          params.model_type === 'polynomial' ? calculatePolynomialGrowth(params) :
                          params.model_type === 'logistic' ? calculateLogisticGrowth(params) :
                          calculateExponentialGrowth(params);
            forecastData = users.map((userCount, i) => ({
                month: i + 1,
                users: userCount,
                cashFlow: params.cf_start + params.cf_step * i,
                pro: i === 5 && params.const_pro_12 ? params.const_pro_12 : userCount * params.revA_pro * params.price_pro,
                family: i === 5 && params.const_family_4 ? params.const_family_4 : userCount * params.revA_family * params.price_family,
                projectedPro: i === 5 && params.const_pro_75 ? params.const_pro_75 : userCount * params.revB_pro * params.price_pro,
                projectedFamily: i === 5 && params.const_family_5 ? params.const_family_5 : userCount * params.revB_family * params.price_family,
                loanCapacity: (params.cf_start + params.cf_step * i) * 7.47 * 12 * 0.8,
                annualCashFlow: (params.cf_start + params.cf_step * i) * 12
            }));
            updateAllViews();
            showNotification('No cached data available. Showing local fallback forecast.', 'warning');
        }
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '🔄 Update Forecast';
    }
};

/**
 * Creates the growth parameters form.
 */
const createGrowthParamsForm = () => {
    const existing = document.getElementById('centered-logging-panel');
    if (existing) existing.remove();

    const formHtml = `
        <form id="growth-params-form" class="row g-3 mb-4" onsubmit="event.preventDefault(); fetchDashboardData();" role="form" aria-label="Growth Parameters Form">
            <div class="mb-4 w-100">
                <label for="growthModel" class="form-label fw-bold">📐 Growth Model:</label>
                <select id="growthModel" class="form-select w-auto d-inline-block" aria-label="Select Growth Model" data-bs-toggle="tooltip" title="Select the user growth model to use for forecasting.">
                    <option value="linear">Linear Extrapolation</option>
                    <option value="polynomial">Polynomial Extrapolation</option>
                    <option value="exponential">Exponential Growth</option>
                    <option value="logistic">Logarithmic/Saturation (S-Curve)</option>
                    <option value="piecewise" selected>Piecewise Growth</option>
                </select>
            </div>
            <div class="col-md-2">
                <label for="months" class="form-label">Months</label>
                <input type="number" class="form-control" id="months" min="1" max="60" value="30" data-bs-toggle="tooltip" title="Number of months to forecast (1-60)." aria-label="Number of months to forecast">
            </div>
            <div class="col-md-2 growth-param growth-linear growth-piecewise">
                <label for="linear_growth" class="form-label">Linear Growth</label>
                <input type="number" class="form-control" id="linear_growth" value="58333" data-bs-toggle="tooltip" title="Monthly user growth for the linear model." aria-label="Linear growth rate">
            </div>
            <div class="col-md-4 growth-param growth-piecewise">
                <label for="rollout" class="form-label">Rollout (comma-separated)</label>
                <input type="text" class="form-control" id="rollout" value="7500,22500,45000,50000,65000,60000" data-bs-toggle="tooltip" title="Initial user rollout numbers for first 6 months." aria-label="Rollout values">
            </div>
            <div class="col-md-2 growth-param growth-piecewise growth-exponential">
                <label for="exp_start" class="form-label">Exp. Start</label>
                <input type="number" class="form-control" id="exp_start" value="60000" data-bs-toggle="tooltip" title="Starting users for exponential model." aria-label="Exponential start value">
            </div>
            <div class="col-md-2 growth-param growth-piecewise growth-exponential">
                <label for="exp_rate" class="form-label">Exp. Rate</label>
                <input type="number" class="form-control" id="exp_rate" step="0.01" value="0.15" data-bs-toggle="tooltip" title="Exponential growth rate (e.g., 0.15 for 15% monthly growth)." aria-label="Exponential growth rate">
            </div>
            <div class="col-md-2 growth-param growth-polynomial">
                <label for="a" class="form-label">a (x²)</label>
                <input type="number" class="form-control" id="a" value="1000" data-bs-toggle="tooltip" title="Quadratic coefficient (a) for the polynomial model." aria-label="Quadratic coefficient a">
            </div>
            <div class="col-md-2 growth-param growth-polynomial">
                <label for="b" class="form-label">b (x)</label>
                <input type="number" class="form-control" id="b" value="30000" data-bs-toggle="tooltip" title="Linear coefficient (b) for the polynomial model." aria-label="Linear coefficient b">
            </div>
            <div class="col-md-2 growth-param growth-polynomial">
                <label for="c" class="form-label">c</label>
                <input type="number" class="form-control" id="c" value="0" data-bs-toggle="tooltip" title="Constant coefficient (c) for the polynomial model." aria-label="Constant coefficient c">
            </div>
            <div class="col-md-2 growth-param growth-logistic">
                <label for="L" class="form-label">L (Max)</label>
                <input type="number" class="form-control" id="L" value="1000000" data-bs-toggle="tooltip" title="Carrying capacity (L): the maximum number of users for the logistic model." aria-label="Carrying capacity L">
            </div>
            <div class="col-md-2 growth-param growth-logistic">
                <label for="k" class="form-label">k (Rate)</label>
                <input type="number" class="form-control" id="k" step="0.01" value="0.3" data-bs-toggle="tooltip" title="Growth rate (k) for the logistic model." aria-label="Logistic growth rate k">
            </div>
            <div class="col-md-2 growth-param growth-logistic">
                <label for="t0" class="form-label">t₀ (Midpoint)</label>
                <input type="number" class="form-control" id="t0" value="12" data-bs-toggle="tooltip" title="Inflection point (t₀): the midpoint month for the logistic model." aria-label="Logistic midpoint t0">
            </div>
            <div class="col-md-2">
                <label for="revA_pro" class="form-label">Pro % (Current)</label>
                <input type="number" class="form-control" id="revA_pro" step="0.01" value="0.12" data-bs-toggle="tooltip" title="Revenue share for Pro users (current split)." aria-label="Pro revenue share current">
            </div>
            <div class="col-md-2">
                <label for="revA_family" class="form-label">Family % (Current)</label>
                <input type="number" class="form-control" id="revA_family" step="0.01" value="0.04" data-bs-toggle="tooltip" title="Revenue share for Family users (current split)." aria-label="Family revenue share current">
            </div>
            <div class="col-md-2">
                <label for="revB_pro" class="form-label">Pro % (Projected)</label>
                <input type="number" class="form-control" id="revB_pro" step="0.01" value="0.75" data-bs-toggle="tooltip" title="Revenue share for Pro users (projected split)." aria-label="Pro revenue share projected">
            </div>
            <div class="col-md-2">
                <label for="revB_family" class="form-label">Family % (Projected)</label>
                <input type="number" class="form-control" id="revB_family" step="0.01" value="0.05" data-bs-toggle="tooltip" title="Revenue share for Family users (projected split)." aria-label="Family revenue share projected">
            </div>
            <div class="col-md-2">
                <label for="cf_start" class="form-label">Cash Flow Start</label>
                <input type="number" class="form-control" id="cf_start" value="15000" data-bs-toggle="tooltip" title="Starting cash flow per month (in dollars)." aria-label="Cash flow start">
            </div>
            <div class="col-md-2">
                <label for="cf_step" class="form-label">Cash Flow Step</label>
                <input type="number" class="form-control" id="cf_step" value="10000" data-bs-toggle="tooltip" title="Cash flow increment per month (in dollars)." aria-label="Cash flow step">
            </div>
            <div class="col-md-2">
                <label for="price_pro" class="form-label">Pro Price ($)</label>
                <input type="number" class="form-control" id="price_pro" step="0.01" value="5.99" data-bs-toggle="tooltip" title="Monthly price for the Pro subscription plan." aria-label="Pro subscription price">
            </div>
            <div class="col-md-2">
                <label for="price_family" class="form-label">Family Price ($)</label>
                <input type="number" class="form-control" id="price_family" step="0.01" value="11.99" data-bs-toggle="tooltip" title="Monthly price for the Family subscription plan." aria-label="Family subscription price">
            </div>
            <div class="col-md-2">
                <label for="const_pro_12" class="form-label">Pro Price (Month 6)</label>
                <input type="number" class="form-control" id="const_pro_12" step="0.01" placeholder="Override Pro 12% value for month 6" data-bs-toggle="tooltip" title="Override the calculated revenue for Pro 12% users in month 6." aria-label="Pro override month 6">
            </div>
            <div class="col-md-2">
                <label for="const_family_4" class="form-label">Family Price (Month 6)</label>
                <input type="number" class="form-control" id="const_family_4" step="0.01" placeholder="Override Family 4% value for month 6" data-bs-toggle="tooltip" title="Override the calculated revenue for Family 4% users in month 6." aria-label="Family override month 6">
            </div>
            <div class="col-md-2">
                <label for="const_pro_75" class="form-label">Pro Price (Month 6)</label>
                <input type="number" class="form-control" id="const_pro_75" step="0.01" placeholder="Override Pro 75% value for month 6" data-bs-toggle="tooltip" title="Override the projected revenue for Pro 75% users in month 6." aria-label="Pro projected override month 6">
            </div>
            <div class="col-md-2">
                <label for="const_family_5" class="form-label">Family Price (Month 6)</label>
                <input type="number" class="form-control" id="const_family_5" step="0.01" placeholder="Override Family 5% value for month 6" data-bs-toggle="tooltip" title="Override the projected revenue for Family 5% users in month 6." aria-label="Family projected override month 6">
            </div>
            <div class="col-12 text-end">
                <button class="btn btn-primary" type="submit" aria-label="Update forecast">🔄 Update Forecast</button>
            </div>
        </form>
    `;

    const temp = document.createElement('div');
    temp.innerHTML = formHtml.trim();
    const formElement = temp.firstElementChild;
    initializeCenteredLoggingPanel(formElement);

    const growthModelSelect = formElement.querySelector('#growthModel');
    const allParams = formElement.querySelectorAll('.growth-param');
    const updateParamVisibility = () => {
        const selectedModel = growthModelSelect.value;
        allParams.forEach(param => {
            param.style.display = param.classList.contains(`growth-${selectedModel}`) ? 'block' : 'none';
        });
    };
    growthModelSelect.addEventListener('change', updateParamVisibility);
    updateParamVisibility();

    const tooltipTriggerList = formElement.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(el => new bootstrap.Tooltip(el));
};

/**
 * Initializes the logging panel.
 */
const initializeLoggingPanel = () => {
    const vigiliaLogHistory = [];
    const logPanel = document.createElement('div');
    logPanel.id = 'vigilia-log-panel';
    logPanel.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; width: 400px; max-height: 300px;
        background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); z-index: 1000; overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    logPanel.innerHTML = `
        <div id="vigilia-log-header" role="banner" style="cursor: move; background: linear-gradient(90deg, #32062E, #9B59B6); color: #FFFFFF; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600;">Console Log</span>
            <span>
                <button id="log-panel-clear" title="Clear logs" style="border: none; background: none; color: #FFFFFF; font-size: 1.1em; cursor: pointer;" aria-label="Clear logs">🧹</button>
                <button id="log-panel-toggle" title="Toggle panel" style="border: none; background: none; color: #FFFFFF; font-size: 1.1em; cursor: pointer;" aria-label="Toggle log panel">⬇</button>
            </span>
        </div>
        <div id="vigilia-log-body" style="padding: 10px; overflow-y: auto; max-height: 250px; font-size: 0.9em; background: #FFFFFF;" role="log"></div>
    `;
    document.body.appendChild(logPanel);

    let isDragging = false, dragOffsetX = 0, dragOffsetY = 0, isMinimized = false;
    const header = logPanel.querySelector('#vigilia-log-header');
    header.addEventListener('mousedown', e => {
        isDragging = true;
        dragOffsetX = e.clientX - logPanel.offsetLeft;
        dragOffsetY = e.clientY - logPanel.offsetTop;
        document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', e => {
        if (isDragging) {
            logPanel.style.left = `${e.clientX - dragOffsetX}px`;
            logPanel.style.top = `${e.clientY - dragOffsetY}px`;
            logPanel.style.right = 'auto';
            logPanel.style.bottom = 'auto';
        }
    });
    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.userSelect = '';
    });

    const renderLogPanel = () => {
        const body = document.getElementById('vigilia-log-body');
        body.innerHTML = '';
        vigiliaLogHistory.forEach(entry => {
            body.innerHTML += `<div class="log-msg log-${entry.type}" style="margin-bottom: 4px; white-space: pre-wrap; word-break: break-word; color: ${entry.type === 'log' ? '#1F2937' : entry.type === 'warn' ? '#D97706' : '#DC2626'};">[${new Date(entry.timestamp).toLocaleTimeString()}] ${entry.type.toUpperCase()}: ${entry.text}</div>`;
        });
        body.scrollTop = body.scrollHeight;
    };

    document.getElementById('log-panel-clear').onclick = () => {
        vigiliaLogHistory.length = 0;
        renderLogPanel();
        console.log('Log panel cleared');
    };
    document.getElementById('log-panel-toggle').onclick = () => {
        isMinimized = !isMinimized;
        document.getElementById('vigilia-log-body').style.display = isMinimized ? 'none' : 'block';
        logPanel.style.maxHeight = isMinimized ? '40px' : '300px';
        document.getElementById('log-panel-toggle').textContent = isMinimized ? '⬆' : '⬇';
        console.log(`Log panel ${isMinimized ? 'minimized' : 'expanded'}`);
    };
    window.addEventListener('keydown', e => {
        if (e.key === 'F8') {
            logPanel.style.display = logPanel.style.display === 'none' ? 'block' : 'none';
            renderLogPanel();
            console.log(`Log panel ${logPanel.style.display === 'none' ? 'hidden' : 'shown'}`);
        }
    });

    const orig = { log: console.log, warn: console.warn, error: console.error };
    const appendLog = (type, args) => {
        const text = Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
        vigiliaLogHistory.push({ type, text: text.replace(/[<>&]/g, ''), timestamp: new Date() });
        if (vigiliaLogHistory.length > MAX_LOG_ENTRIES) vigiliaLogHistory.shift();
        renderLogPanel();
        orig[type].apply(console, args);
    };
    console.log = (...args) => appendLog('log', args);
    console.warn = (...args) => appendLog('warn', args);
    console.error = (...args) => appendLog('error', args);
};

/**
 * Initializes the centered logging panel.
 * @param {HTMLElement} formElement - The form element to append.
 */
const initializeCenteredLoggingPanel = (formElement) => {
    const existing = document.getElementById('centered-logging-panel');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'centered-logging-panel';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 3000; display: flex;
        align-items: center; justify-content: center;
        background: rgba(31,41,55,0.18);
        animation: fade-in 0.3s;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
        background: #fff; border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
        width: 98vw; max-width: 600px; max-height: 90vh; overflow-y: auto;
        display: flex; flex-direction: column; padding: 0; position: relative;
        animation: fade-in 0.4s;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(90deg, #32062E, #9B59B6);
        color: #fff; font-weight: 600; font-size: 1.1rem;
        padding: 16px 24px; border-top-left-radius: 14px; border-top-right-radius: 14px;
        display: flex; align-items: center; justify-content: space-between;
    `;
    header.innerHTML = `<span>Forecast Parameters</span>
        <button type="button" aria-label="Close panel" style="background:none;border:none;color:#fff;font-size:1.7rem;line-height:1;cursor:pointer;">×</button>`;

    header.querySelector('button').onclick = () => overlay.remove();
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

    const body = document.createElement('div');
    body.style.cssText = 'padding: 24px; background: #f9fafb;';
    body.appendChild(formElement);

    card.appendChild(header);
    card.appendChild(body);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    setTimeout(() => {
        const firstInput = overlay.querySelector('input,select,textarea,button');
        if (firstInput) firstInput.focus();
    }, 100);
};

/**
 * Generates revenue labels for forecast data.
 * @param {Object} params - Growth parameters.
 * @returns {Object} Revenue labels.
 */
const getRevenueLabels = (params) => ({
    pro_12: `Pro ${params.Pro_Users_12_perc}% @ ${params.price_pro}`,
    family_4: `Family ${params.Family_Users_4_perc}% @ ${params.price_family}`,
    pro_75: `Pro ${params.Pro_Users_75_perc}% @ ${params.price_pro}`,
    family_5: `Family ${params.Family_Users_5_perc}% @ ${params.price_family}`
});

/**
 * Populates the projections table.
 * @param {string} timeframe - Timeframe for data ('12m', '24m', '30m').
 */
const populateProjectionsTable = (timeframe = DEFAULT_TIMEFRAME) => {
    const tableBody = document.getElementById('projections-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const months = timeframe === '12m' ? 12 : timeframe === '24m' ? 24 : 30;
    const filteredData = forecastData.filter(row => row.month <= months);

    filteredData.forEach(row => {
        const currentRevenue = (row.pro || 0) + (row.family || 0);
        const projectedRevenue = (row.projectedPro || 0) + (row.projectedFamily || 0);
        const status = projectedRevenue >= (row.cashFlow || 0) * 0.8 ? 'Excellent' : 'Good';
        tableBody.innerHTML += `
            <tr>
                <td>Month ${row.month}</td>
                <td>${formatNumber(row.users || 0)}</td>
                <td>${formatCurrency(row.cashFlow || 0)}</td>
                <td>${formatCurrency(currentRevenue)}</td>
                <td>${formatCurrency(projectedRevenue)}</td>
                <td>${formatCurrency(row.loanCapacity || 0)}</td>
                <td><span class="status-badge status-${status.toLowerCase()}" role="status">${status}</span></td>
            </tr>
        `;
    });
};

/**
 * Updates all dashboard views based on the selected view.
 */
const updateAllViews = () => {
    updateMetricCards();
    populateMetricsStatusTable();
    updateActivityFeed();
    populateDailyDataTable();
    updateGrowthGoals();

    if (selectedView === 'overview') {
        initializeUserGrowthChart(document.getElementById('app-performance-timeframe')?.value || '7d');
        initializeCashFlowChart(document.getElementById('financial-timeframe')?.value || DEFAULT_TIMEFRAME);
    } else if (selectedView === 'revenue') {
        initializeRevenueChart(document.getElementById('revenue-timeframe')?.value || DEFAULT_TIMEFRAME);
        initializeSubscriptionRevenueChart();
        initializeSubscriptionPieChart();
        populateSubscriptionTable(document.getElementById('subscription-scenario')?.value || 'all');
    } else if (selectedView === 'financing') {
        initializeFinancingChart(document.getElementById('financing-timeframe')?.value || DEFAULT_TIMEFRAME);
        updateFinancingMetrics();
        populateProjectionsTable(document.getElementById('financing-timeframe')?.value || DEFAULT_TIMEFRAME);
    }
    console.log(`Updated all views for ${selectedView}`);
};

/**
 * Sets today's date in the daily data form.
 */
const setTodaysDate = () => {
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
};

/**
 * Initializes event listeners for the dashboard.
 */
const initializeEventListeners = () => {
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
    
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.addEventListener('click', () => renderView(tab.dataset.view));
        tab.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                renderView(tab.dataset.view);
            }
        });
    });

    document.getElementById('app-performance-timeframe')?.addEventListener('change', (e) => {
        initializeUserGrowthChart(e.target.value);
        console.log(`App performance timeframe changed to ${e.target.value}`);
    });

    document.getElementById('financial-timeframe')?.addEventListener('change', (e) => {
        initializeCashFlowChart(e.target.value);
        console.log(`Financial timeframe changed to ${e.target.value}`);
    });

    document.getElementById('revenue-timeframe')?.addEventListener('change', (e) => {
        initializeRevenueChart(e.target.value);
        console.log(`Revenue timeframe changed to ${e.target.value}`);
    });

    document.getElementById('financing-timeframe')?.addEventListener('change', (e) => {
        initializeFinancingChart(e.target.value);
        populateProjectionsTable(e.target.value);
        console.log(`Financing timeframe changed to ${e.target.value}`);
    });

    document.getElementById('subscription-scenario')?.addEventListener('change', (e) => {
        populateSubscriptionTable(e.target.value);
        console.log(`Subscription scenario changed to ${e.target.value}`);
    });

    document.getElementById('daily-data-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        addData();
    });

    document.getElementById('export-app-data')?.addEventListener('click', exportAppData);
    document.getElementById('export-financial-data')?.addEventListener('click', exportFinancialData);
    document.getElementById('reset-form')?.addEventListener('click', resetForm);

    // Initialize tooltips
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
        new bootstrap.Tooltip(el);
    });
};

/**
 * Initializes the dashboard.
 */
const initializeDashboard = () => {
    // Load theme from localStorage
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        document.querySelector('.theme-toggle').textContent = '☀️';
    }

    // Set default date
    setTodaysDate();

    // Initialize logging panel
    initializeLoggingPanel();

    // Create growth parameters form
    createGrowthParamsForm();

    // Initialize event listeners
    initializeEventListeners();

    // Fetch initial data
    fetchDashboardData();

    console.log('Dashboard initialized successfully');
};

// Expose global functions for HTML event handlers
window.editData = editData;
window.deleteData = deleteData;

// Start the dashboard
document.addEventListener('DOMContentLoaded', initializeDashboard);