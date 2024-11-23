// Run this in your browser console to generate base64 icons
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

function createIcon(size) {
    canvas.width = size;
    canvas.height = size;
    
    // Draw a simple colored circle
    ctx.fillStyle = '#4a90e2';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    
    // Add text
    ctx.fillStyle = 'white';
    ctx.font = `${size/2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('T', size/2, size/2);
    
    return canvas.toDataURL('image/png');
}

// Generate icons
const sizes = [16, 48, 128];
sizes.forEach(size => {
    const link = document.createElement('a');
    link.download = `icon${size}.png`;
    link.href = createIcon(size);
    link.click();
}); 