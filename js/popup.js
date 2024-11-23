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
    document.querySelectorAll('.chip').forEach(button => {
        button.addEventListener('click', (e) => {
            const chartType = e.currentTarget.dataset.chart;
            switchChart(chartType);
            
            document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'refresh-button';
    refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
    document.querySelector('.chart-container').appendChild(refreshBtn);

    refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('spinning');
        
        refreshBtn.disabled = true;

        try {
            await loadData();
        } catch (error) {
            console.error('Error refreshing data:', error);
        }

        setTimeout(() => {
            refreshBtn.classList.remove('spinning');
            refreshBtn.disabled = false;
        }, 500);
    });

    const sortButton = document.querySelector('.sort-button');
    const sortMenu = document.querySelector('.sort-menu');
    
    if (sortButton && sortMenu) {
        sortButton.addEventListener('click', (e) => {
            e.stopPropagation();
            sortMenu.classList.toggle('show');
            sortButton.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.sort-dropdown')) {
                sortMenu.classList.remove('show');
                sortButton.classList.remove('active');
            }
        });

        document.querySelectorAll('.sort-menu button').forEach(button => {
            button.addEventListener('click', (e) => {
                const sortBy = e.currentTarget.dataset.sort;
                loadData(sortBy);
                
                document.querySelectorAll('.sort-menu button').forEach(btn => {
                    btn.classList.toggle('active', btn === e.currentTarget);
                });
                
                sortMenu.classList.remove('show');
                sortButton.classList.remove('active');
            });
        });
    }
}

async function loadData(sortBy = 'time') {
    setLoading(true);
    
    const { theme } = await chrome.storage.local.get({ theme: 'light' });
    document.body.setAttribute('data-theme', theme);
    
    const data = await chrome.storage.local.get('visits');
    const visits = data.visits || {};
    currentChartData = visits;
    const hasData = Object.keys(visits).length > 0;
    
    if (hasData) {
        hideSkeletonLoading();
        updateChart(visits);
        updateSitesList(visits, sortBy);
    } else {
        showEmptyState();
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
        refreshBtn?.removeAttribute('disabled');
        
        if (!currentChartData || Object.keys(currentChartData || {}).length === 0) {
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
    
    const existingEmpty = chartContainer.querySelector('.empty-state');
    if (existingEmpty) existingEmpty.remove();
    
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
        <i class="fas fa-chart-pie"></i>
        <p>No tracking data yet</p>
    `;
    chartContainer.appendChild(emptyState);
    
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
    chartContainer.style.padding = '20px';
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

    const sortedSites = Object.entries(groupedVisits)
        .sort(([,a], [,b]) => b.totalTimeSpent - a.totalTimeSpent);

    const topSites = sortedSites.slice(0, 6);
    const otherSites = sortedSites.slice(6);

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
            details: otherSitesDetails
        }]);
    }

    const labels = topSites.map(([domain]) => domain);
    const data = topSites.map(([, data]) => data.totalTimeSpent);
    const total = data.reduce((a, b) => a + b, 0);
    const percentages = data.map(time => ((time / total) * 100).toFixed(2));
    
    const colors = generateColors(labels.length - (othersTotal > 0 ? 1 : 0));
    if (othersTotal > 0) {
        colors.push('#94a3b8');
    }

    window.siteColors = Object.fromEntries(labels.map((domain, i) => [domain, colors[i]]));
    window.fullUrls = Object.fromEntries(topSites.map(([domain, data]) => [domain, data.fullUrl]));

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
                duration: 300,
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
                    
                    currentChart.data.datasets[0].backgroundColor = fadedColors;
                    currentChart.update('active');

                    const domain = labels[idx];
                    const percentage = percentages[idx];
                    const data = topSites[idx][1];
                    const time = await formatTime(data.totalTimeSpent);

                    let tooltipContent = `
                        <div class="percentage">${percentage}%</div>
                        <div class="domain">${data.fullUrl}</div>
                        <div class="time">${time}</div>
                    `;

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
                    
                    const chartContainer = document.querySelector('.chart-container');
                    const containerRect = chartContainer.getBoundingClientRect();
                    const tooltipWidth = centerText.offsetWidth;
                    const tooltipHeight = centerText.offsetHeight;
                    
                    let x = event.native.clientX - containerRect.left;
                    let y = event.native.clientY - containerRect.top;

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
    const palette = [
        '#FF4B4B',
        '#00BFA5',
        '#2196F3',
        '#FFC107',
        '#4CAF50',
        '#9C27B0',
        '#FF9800'
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

    for (const [domain, data] of sortedSites) {
        const percentage = ((data.totalTimeSpent / total) * 100).toFixed(2);
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

    setTimeout(() => modal.classList.add('show'), 10);

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
    
    const hasHoverEffect = Array.isArray(currentChart.data.datasets[0].backgroundColor) &&
        currentChart.data.datasets[0].backgroundColor.some(color => color.endsWith('80'));
    
    if (hasHoverEffect) {
        return false;
    }
    
    return !oldData.every((val, i) => Math.abs(val - newValues[i]) < 1);
}

function cleanDomain(domain) {
    const parts = domain.split('.');
    
    if (parts.length > 2) {
        const lastTwo = parts.slice(-2).join('.');
        const specialTlds = ['co.uk', 'com.br', 'co.jp', 'com.au', 'co.nz'];
        
        if (specialTlds.includes(lastTwo)) {
            return parts.slice(-3).join('.');
        } else {
            return parts.slice(-2).join('.');
        }
    }
    
    return domain;
}

function isMouseOverChart(event, chart) {
    const chartArea = chart.canvas.getBoundingClientRect();
    return (
        event.clientX >= chartArea.left &&
        event.clientX <= chartArea.right &&
        event.clientY >= chartArea.top &&
        event.clientY <= chartArea.bottom
    );
}

function getSortIcon(sortBy) {
    switch(sortBy) {
        case 'visits':
            return 'fa-arrow-up-9-1';
        case 'recent':
            return 'fa-clock';
        case 'time':
        default:
            return 'fa-hourglass';
    }
}
 