class AudioVisualizer {
    constructor(audioElement) {
        this.audioElement = audioElement;
        this.canvas = document.getElementById('visualizer-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.dataArray = null;
        this.bufferLength = null;
        
        this.initialized = false;
        this.mode = 'bars'; // 'bars', 'wave', 'circle'
        this.animationId = null;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        const vizBtn = document.getElementById('viz-mode-btn');
        if (vizBtn) {
            vizBtn.addEventListener('click', () => this.toggleMode());
        }
    }

    init() {
        if (this.initialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            
            // Connect to source
            this.source = this.audioContext.createMediaElementSource(this.audioElement);
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            this.analyser.fftSize = 256;
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            
            this.initialized = true;
            this.draw();
        } catch (e) {
            console.error('AudioContext initialization failed', e);
        }
    }

    resize() {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    toggleMode() {
        const modes = ['bars', 'wave', 'circle'];
        let idx = modes.indexOf(this.mode);
        this.mode = modes[(idx + 1) % modes.length];
    }

    draw() {
        if (!this.initialized) return;
        
        this.animationId = requestAnimationFrame(() => this.draw());
        
        if (this.mode === 'wave') {
            this.analyser.getByteTimeDomainData(this.dataArray);
        } else {
            this.analyser.getByteFrequencyData(this.dataArray);
        }
        
        // FAKE VISUALIZER FALLBACK FOR CORS-BLOCKED STREAMS
        // If the audio is playing but the analyser returns all 0s (CORS block)
        if (!this.audioElement.paused && this.dataArray[0] === 0 && this.dataArray[this.bufferLength-1] === 0 && this.dataArray[Math.floor(this.bufferLength/2)] === 0) {
            const t = Date.now() / 200;
            for (let i = 0; i < this.bufferLength; i++) {
                if (this.mode === 'wave') {
                    // Simulate waveform (128 is center)
                    this.dataArray[i] = 128 + (Math.sin(t + i*0.1) * 40) + (Math.random() * 20 - 10);
                } else {
                    // Simulate frequency bars
                    const val = Math.max(0, Math.sin(t + i*0.1) * 150 + Math.random() * 100);
                    this.dataArray[i] = val;
                }
            }
        }
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.mode === 'bars') {
            this.drawBars();
        } else if (this.mode === 'wave') {
            this.drawWave();
        } else if (this.mode === 'circle') {
            this.drawCircle();
        }
    }

    drawBars() {
        const barWidth = (this.canvas.width / this.bufferLength) * 2.5;
        let x = 0;
        
        for (let i = 0; i < this.bufferLength; i++) {
            const barHeight = (this.dataArray[i] / 255) * this.canvas.height;
            
            const r = this.dataArray[i] + (25 * (i/this.bufferLength));
            const g = 250 * (i/this.bufferLength);
            const b = 50;
            
            this.ctx.fillStyle = `rgb(${r},${g},${b})`;
            this.ctx.fillRect(x, this.canvas.height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }

    drawWave() {
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'rgb(29, 185, 84)';
        this.ctx.beginPath();
        
        const sliceWidth = this.canvas.width * 1.0 / this.bufferLength;
        let x = 0;
        
        for (let i = 0; i < this.bufferLength; i++) {
            const v = this.dataArray[i] / 128.0;
            const y = v * this.canvas.height / 2;
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.ctx.stroke();
    }

    drawCircle() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;
        
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.stroke();
        
        for (let i = 0; i < this.bufferLength; i++) {
            const barHeight = (this.dataArray[i] / 255) * (radius * 0.8);
            const rads = Math.PI * 2 / this.bufferLength;
            
            const x = centerX + Math.cos(rads * i) * radius;
            const y = centerY + Math.sin(rads * i) * radius;
            const xEnd = centerX + Math.cos(rads * i) * (radius + barHeight);
            const yEnd = centerY + Math.sin(rads * i) * (radius + barHeight);
            
            this.ctx.strokeStyle = `hsl(${(i/this.bufferLength) * 360}, 100%, 50%)`;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(xEnd, yEnd);
            this.ctx.stroke();
        }
    }
}
