let currentChart = null;
let currentChartType = 'doughnut';
let updateTimeout = null;
let isLoading = true;
let currentChartData = null;
let colors = [];

document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    loadData();
});

function initializeUI() {
    // Set up chart type selector
    document.querySelectorAll('.chip').forEach(button => {
        button.addEventListener('click', (e) => {
            const chartType = e.currentTarget.dataset.chart;
            switchChart(chartType);
            
            // Update active state
            document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    // Set up settings button to open options page
    document.getElementById('settingsBtn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Add refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'refresh-button';
    refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
    document.querySelector('.chart-container').appendChild(refreshBtn);

    refreshBtn.addEventListener('click', async () => {
        // Add spinning animation
        refreshBtn.classList.add('spinning');
        
        // Disable button during refresh
        refreshBtn.disabled = true;

        try {
            await loadData();
        } catch (error) {
            console.error('Error refreshing data:', error);
        }

        // Remove spinning animation after a minimum duration
        setTimeout(() => {
            refreshBtn.classList.remove('spinning');
            refreshBtn.disabled = false;
        }, 500);
    });

    // Add sort dropdown functionality
    const sortButton = document.querySelector('.sort-button');
    const sortMenu = document.querySelector('.sort-menu');
    
    if (sortButton && sortMenu) {
        sortButton.addEventListener('click', (e) => {
            e.stopPropagation();
            sortMenu.classList.toggle('show');
        });

        // Close sort menu when clicking outside
        document.addEventListener('click', () => {
            sortMenu.classList.remove('show');
        });

        // Handle sort selection
        document.querySelectorAll('.sort-menu button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const sortBy = button.dataset.sort;
                
                // Update active state
                document.querySelectorAll('.sort-menu button').forEach(b => 
                    b.classList.remove('active'));
                button.classList.add('active');
                
                // Update sort button icon based on sort type
                const icon = getSortIcon(sortBy);
                sortButton.innerHTML = `<i class="fas ${icon}"></i>`;
                
                // Reload data with new sort
                loadData(sortBy);
                sortMenu.classList.remove('show');
            });
        });
    }
}

async function loadData(sortBy = 'time') {
    setLoading(true);
    
    // Load theme
    const { theme } = await chrome.storage.local.get({ theme: 'light' });
    document.body.setAttribute('data-theme', theme);
    
    const data = await chrome.storage.local.get('visits');
    const visits = data.visits || {};
    const hasData = Object.keys(visits).length > 0;
    
    if (hasData) {
        hideSkeletonLoading();
        updateChart(visits);
        updateSitesList(visits, sortBy);
        enableControls();
    } else {
        showEmptyState();
        disableControls();
    }
    
    setLoading(false);
}

function setLoading(loading) {
    isLoading = loading;
    const refreshBtn = document.querySelector('.refresh-button');
    const sortBtn = document.querySelector('.sort-button');
    
    if (loading) {
        refreshBtn?.classList.add('spinning');
        sortBtn?.setAttribute('disabled', 'true');
        sortBtn?.classList.add('disabled');
    } else {
        refreshBtn?.classList.remove('spinning');
        
        // Only enable sort button if we have data
        const hasData = Object.keys(currentChartData || {}).length > 0;
        if (!hasData) {
            sortBtn?.setAttribute('disabled', 'true');
            sortBtn?.classList.add('disabled');
        } else {
            sortBtn?.removeAttribute('disabled');
            sortBtn?.classList.remove('disabled');
        }
    }
}

function showEmptyState() {
    const chartContainer = document.querySelector('.chart-container');
    const canvas = document.getElementById('mainChart');
    canvas.style.display = 'none';
    
    // Remove any existing empty state
    const existingEmpty = chartContainer.querySelector('.empty-state');
    if (existingEmpty) existingEmpty.remove();
    
    // Add empty state message
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
        <i class="fas fa-chart-pie"></i>
        <p>No tracking data yet</p>
    `;
    chartContainer.appendChild(emptyState);
    
    // Show empty state in overview section
    const sitesList = document.getElementById('sitesList');
    sitesList.innerHTML = `
        <div class="empty-state">
            <p>Start browsing to see your activity</p>
        </div>
    `;
}

function showSkeletonLoading() {
    if (!currentChartData || Object.keys(currentChartData).length === 0) {
        return;
    }
    
    const chartContainer = document.querySelector('.chart-container');
    const canvas = document.getElementById('mainChart');
    canvas.style.display = 'none';
    
    if (!document.querySelector('.skeleton-chart')) {
        const skeletonChart = document.createElement('div');
        skeletonChart.className = 'skeleton skeleton-chart';
        chartContainer.appendChild(skeletonChart);
    }
    
    const sitesList = document.getElementById('sitesList');
    sitesList.innerHTML = '';
    
    for (let i = 0; i < 3; i++) {
        const skeletonItem = document.createElement('div');
        skeletonItem.className = 'skeleton skeleton-item';
        sitesList.appendChild(skeletonItem);
    }
}

function hideSkeletonLoading() {
    const chartContainer = document.querySelector('.chart-container');
    const skeletonChart = document.querySelector('.skeleton-chart');
    const canvas = document.getElementById('mainChart');
    
    if (skeletonChart) {
        skeletonChart.remove();
    }
    chartContainer.style.padding = '20px'; // Restore padding
    canvas.style.display = 'block';
    
    const sitesList = document.getElementById('sitesList');
    const skeletonItems = sitesList.querySelectorAll('.skeleton-item');
    skeletonItems.forEach(item => item.remove());
}

function enableControls() {
    const refreshBtn = document.querySelector('.refresh-button');
    const exportBtn = document.querySelector('.action-button:not(.danger)');
    const clearBtn = document.querySelector('.action-button.danger');
    
    refreshBtn?.removeAttribute('disabled');
    exportBtn?.removeAttribute('disabled');
    clearBtn?.removeAttribute('disabled');
}

function disableControls() {
    const refreshBtn = document.querySelector('.refresh-button');
    const exportBtn = document.querySelector('.action-button:not(.danger)');
    const clearBtn = document.querySelector('.action-button.danger');
    
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = '0.5';
        refreshBtn.style.cursor = 'not-allowed';
    }
    
    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.style.opacity = '0.5';
        exportBtn.style.cursor = 'not-allowed';
    }
    
    if (clearBtn) {
        clearBtn.disabled = true;
        clearBtn.style.opacity = '0.5';
        clearBtn.style.cursor = 'not-allowed';
    }
}

function updateChart(visits) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    if (currentChart) {
        currentChart.destroy();
    }

    const chartData = processDataForChart(visits, currentChartType);
    currentChart = new Chart(ctx, chartData);

    // Add center text container if it doesn't exist
    if (!document.querySelector('.chart-center-text')) {
        const centerText = document.createElement('div');
        centerText.className = 'chart-center-text';
        document.querySelector('.chart-container').appendChild(centerText);
    }
}

function processDataForChart(visits, type = 'doughnut') {
    const groupedVisits = {};
    Object.entries(visits).forEach(([domain, data]) => {
        if (domain.startsWith('chrome://')) return;
        const cleanedDomain = cleanDomain(domain);
        if (!groupedVisits[cleanedDomain]) {
            groupedVisits[cleanedDomain] = {
                count: 0,
                totalTimeSpent: 0,
                lastVisited: data.lastVisited,
                fullUrl: domain
            };
        }
        groupedVisits[cleanedDomain].count += data.count;
        groupedVisits[cleanedDomain].totalTimeSpent += data.totalTimeSpent;
    });

    // Sort all sites by time spent
    const sortedSites = Object.entries(groupedVisits)
        .sort(([,a], [,b]) => b.totalTimeSpent - a.totalTimeSpent);

    // Take top 6 sites and group the rest into "Others"
    const topSites = sortedSites.slice(0, 6);
    const otherSites = sortedSites.slice(6);

    // Calculate total time for "Others"
    const othersTotal = otherSites.reduce((sum, [,data]) => sum + data.totalTimeSpent, 0);
    
    if (othersTotal > 0) {
        const otherSitesDetails = otherSites.map(([domain, data]) => ({
            domain: data.fullUrl,
            time: data.totalTimeSpent
        }));

        topSites.push(['Others', {
            count: otherSites.reduce((sum, [,data]) => sum + data.count, 0),
            totalTimeSpent: othersTotal,
            lastVisited: new Date().toLocaleString(),
            fullUrl: `${otherSites.length} other sites`,
            details: otherSitesDetails  // Add details for tooltip
        }]);
    }

    const labels = topSites.map(([domain]) => domain);
    const data = topSites.map(([, data]) => data.totalTimeSpent);
    const total = data.reduce((a, b) => a + b, 0);
    const percentages = data.map(time => ((time / total) * 100).toFixed(2));
    
    // Generate colors with grey for "Others"
    const colors = generateColors(labels.length - (othersTotal > 0 ? 1 : 0));  // Generate colors for all except "Others"
    if (othersTotal > 0) {
        colors.push('#94a3b8');  // Add grey for "Others"
    }

    // Store colors and full URLs for site list
    window.siteColors = Object.fromEntries(labels.map((domain, i) => [domain, colors[i]]));
    window.fullUrls = Object.fromEntries(topSites.map(([domain, data]) => [domain, data.fullUrl]));

    // Get the computed background color of the chart container
    const chartContainer = document.querySelector('.chart-container');
    const containerBgColor = getComputedStyle(chartContainer).backgroundColor;

    const config = {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: percentages,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: 'transparent',
                hoverBorderColor: 'transparent',
                hoverBorderWidth: 2,
                spacing: topSites.length === 1 ? 0 : 2,
                offset: 0,
                weight: 1,
                hoverOffset: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            animation: {
                duration: 300,  // Match CSS transition duration
                easing: 'easeInOutQuad'
            },
            transitions: {
                active: {
                    animation: {
                        duration: 300
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            },
            onHover: async (event, elements) => {
                const centerText = document.querySelector('.chart-center-text');
                
                if (!isMouseOverChart(event.native, event.chart)) {
                    centerText.style.opacity = '0';
                    if (currentChart) {
                        const originalColors = colors.map(color => color);
                        currentChart.data.datasets[0].backgroundColor = originalColors;
                        currentChart.update('none');
                    }
                    return;
                }

                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const fadedColors = colors.map((color, i) => 
                        i === idx ? color : color + '40'
                    );
                    
                    // Apply transition to color changes
                    currentChart.data.datasets[0].backgroundColor = fadedColors;
                    currentChart.update('active');  // Use 'active' mode for smooth transitions

                    const domain = labels[idx];
                    const percentage = percentages[idx];
                    const data = topSites[idx][1];
                    const time = await formatTime(data.totalTimeSpent);

                    let tooltipContent = `
                        <div class="percentage">${percentage}%</div>
                        <div class="domain">${data.fullUrl}</div>
                        <div class="time">${time}</div>
                    `;

                    // Add details for Others group
                    if (domain === 'Others' && data.details) {
                        tooltipContent += `<div class="others-details">`;
                        for (const site of data.details) {
                            const siteTime = await formatTime(site.time);
                            tooltipContent += `<div class="other-site">${site.domain}: ${siteTime}</div>`;
                        }
                        tooltipContent += `</div>`;
                    }

                    centerText.innerHTML = tooltipContent;
                    centerText.style.opacity = '1';
                    
                    // Position tooltip
                    const chartContainer = document.querySelector('.chart-container');
                    const containerRect = chartContainer.getBoundingClientRect();
                    const tooltipWidth = centerText.offsetWidth;
                    const tooltipHeight = centerText.offsetHeight;
                    
                    // Calculate position relative to chart container
                    let x = event.native.clientX - containerRect.left;
                    let y = event.native.clientY - containerRect.top;

                    // Ensure tooltip stays within container bounds
                    if (x + tooltipWidth > containerRect.width - 10) {
                        x = containerRect.width - tooltipWidth - 10;
                    }
                    if (x < 10) {
                        x = 10;
                    }
                    
                    if (y + tooltipHeight > containerRect.height - 10) {
                        y = containerRect.height - tooltipHeight - 10;
                    }
                    if (y < 10) {
                        y = 10;
                    }

                    centerText.style.left = `${x}px`;
                    centerText.style.top = `${y}px`;
                    centerText.style.transform = 'none';
                } else {
                    centerText.style.opacity = '0';
                    const originalColors = colors.map(color => color);
                    currentChart.data.datasets[0].backgroundColor = originalColors;
                    currentChart.update('active');
                }
            },
            events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
            onLeave: () => {
                // Reset everything when mouse leaves chart
                const centerText = document.querySelector('.chart-center-text');
                centerText.style.opacity = '0';
                if (currentChart) {
                    currentChart.data.datasets[0].backgroundColor = colors;
                    currentChart.update('none');
                }
            },
            layout: {
                padding: 0
            },
            radius: '90%',
            cutout: '65%'
        }
    };

    return config;
}

function generateColors(count) {
    // Updated color palette with more contrasting colors
    const palette = [
        '#FF4B4B', // Brighter Red
        '#00BFA5', // Vibrant Teal
        '#2196F3', // Bright Blue
        '#FFC107', // Vivid Yellow
        '#4CAF50', // Strong Green
        '#9C27B0', // Rich Purple
        '#FF9800'  // Bright Orange
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(palette[i % palette.length]);
    }
    
    return colors;
}

async function updateSitesList(visits, sortBy = 'time') {
    const sitesList = document.getElementById('sitesList');
    sitesList.innerHTML = '';

    // Filter and group visits
    const groupedVisits = {};
    Object.entries(visits).forEach(([domain, data]) => {
        if (domain.startsWith('chrome://')) return;
        
        const cleanedDomain = cleanDomain(domain);
        if (!groupedVisits[cleanedDomain]) {
            groupedVisits[cleanedDomain] = {
                count: 0,
                totalTimeSpent: 0,
                lastVisited: data.lastVisited,
                fullUrl: domain,
                visits: 0
            };
        }
        
        groupedVisits[cleanedDomain].count += data.count;
        groupedVisits[cleanedDomain].totalTimeSpent += data.totalTimeSpent;
        groupedVisits[cleanedDomain].visits += data.count;
        
        if (new Date(data.lastVisited) > new Date(groupedVisits[cleanedDomain].lastVisited)) {
            groupedVisits[cleanedDomain].lastVisited = data.lastVisited;
            groupedVisits[cleanedDomain].fullUrl = domain;
        }
    });

    // Sort sites based on selected method
    const sortedSites = Object.entries(groupedVisits).sort(([,a], [,b]) => {
        switch(sortBy) {
            case 'visits':
                return b.visits - a.visits;
            case 'recent':
                return new Date(b.lastVisited) - new Date(a.lastVisited);
            case 'time':
            default:
                return b.totalTimeSpent - a.totalTimeSpent;
        }
    });

    const total = sortedSites.reduce((sum, [,data]) => sum + data.totalTimeSpent, 0);

    // Create list items for all sites
    for (const [domain, data] of sortedSites) {
        const percentage = ((data.totalTimeSpent / total) * 100).toFixed(2);
        // Use the same color as chart if it's in top 6, otherwise use grey
        const color = window.siteColors[domain] || '#94a3b8';
        const formattedTime = await formatTime(data.totalTimeSpent);
        
        const item = document.createElement('div');
        item.className = 'site-item';
        
        item.innerHTML = `
            <div class="site-info">
                <div class="color-dot" style="background-color: ${color}"></div>
                <div class="domain-info">
                    <span class="domain">${data.fullUrl}</span>
                    <span class="visit-count">${data.visits} visits</span>
                </div>
            </div>
            <div class="stats">
                <span class="percentage">${percentage}%</span>
                <span class="time">${formattedTime}</span>
            </div>
        `;
        sitesList.appendChild(item);
    }
}

async function formatTime(seconds) {
    const { showSeconds } = await chrome.storage.local.get({ showSeconds: false });
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (showSeconds) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else {
        return `${hours}h ${minutes}m`;
    }
}

async function exportData() {
    const data = await chrome.storage.local.get('visits');
    const blob = new Blob([JSON.stringify(data.visits, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `trackmyweb-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function clearData() {
    const modal = document.createElement('div');
    modal.className = 'confirmation-modal';
    modal.innerHTML = `
        <h3>Clear All Data</h3>
        <p>Are you sure you want to clear all tracking data? This action cannot be undone.</p>
        <div class="confirmation-buttons">
            <button class="cancel-button">Cancel</button>
            <button class="confirm-button">Clear Data</button>
        </div>
    `;
    document.body.appendChild(modal);

    // Show modal with animation
    setTimeout(() => modal.classList.add('show'), 10);

    // Handle button clicks
    return new Promise((resolve) => {
        modal.querySelector('.cancel-button').onclick = () => {
            modal.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(modal);
                resolve(false);
            }, 300);
        };

        modal.querySelector('.confirm-button').onclick = async () => {
            await chrome.storage.local.set({ visits: {} });
            modal.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(modal);
                resolve(true);
            }, 300);
            loadData();
        };
    });
}

function switchChart(type) {
    currentChartType = type;
    updateChart(currentChartData);
}

function needsChartUpdate(newData) {
    if (!currentChart) return true;
    
    const oldData = currentChart.data.datasets[0].data;
    const newValues = Object.values(newData)
        .sort((a, b) => b.totalTimeSpent - a.totalTimeSpent)
        .slice(0, 5)
        .map(v => v.totalTimeSpent);
    
    // If there's a hover effect active, preserve it
    const hasHoverEffect = Array.isArray(currentChart.data.datasets[0].backgroundColor) &&
        currentChart.data.datasets[0].backgroundColor.some(color => color.endsWith('80'));
    
    if (hasHoverEffect) {
        return false;
    }
    
    // Check if values have changed significantly (more than 1 second)
    return !oldData.every((val, i) => Math.abs(val - newValues[i]) < 1);
}

// Update the cleanDomain function to handle any subdomain
function cleanDomain(domain) {
    // Split the domain by dots
    const parts = domain.split('.');
    
    // If we have more than 2 parts (subdomains present)
    if (parts.length > 2) {
        // Check for special cases like co.uk, com.br, etc.
        const lastTwo = parts.slice(-2).join('.');
        const specialTlds = ['co.uk', 'com.br', 'co.jp', 'com.au', 'co.nz'];
        
        if (specialTlds.includes(lastTwo)) {
            // Return last three parts for special TLDs
            return parts.slice(-3).join('.');
        } else {
            // Return just the last two parts for normal domains
            return parts.slice(-2).join('.');
        }
    }
    
    // Return as is if it's already a base domain
    return domain;
}

// Example usage:
// cleanDomain('api.dev.example.com') -> 'example.com'
// cleanDomain('shop.example.co.uk') -> 'example.co.uk'
// cleanDomain('example.com') -> 'example.com'
// cleanDomain('subdomain.blog.example.com.br') -> 'example.com.br'

// Add this function to check if mouse is over chart
function isMouseOverChart(event, chart) {
    const chartArea = chart.canvas.getBoundingClientRect();
    return (
        event.clientX >= chartArea.left &&
        event.clientX <= chartArea.right &&
        event.clientY >= chartArea.top &&
        event.clientY <= chartArea.bottom
    );
}

// Add this helper function to get the appropriate icon
function getSortIcon(sortBy) {
    switch(sortBy) {
        case 'visits':
            return 'fa-arrow-up-9-1';  // Icon for most visits
        case 'recent':
            return 'fa-clock';         // Icon for recently visited
        case 'time':
        default:
            return 'fa-hourglass';     // Icon for time spent
    }
}
 