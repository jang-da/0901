/**
 * Interactive Noise Field
 *
 * 이 스크립트는 Simplex Noise를 사용하여 파티클 필드를 생성하고 애니메이션을 적용합니다.
 * 사용자는 화면을 클릭하여 애니메이션을 제어할 수 있습니다.
 */

/**
 * A standalone, dependency-free implementation of the Simplex Noise algorithm in 2D.
 * Based on the work of Ken Perlin.
 */
class SimplexNoise {
    /**
     * SimplexNoise 생성자
     * @param {function} random - 0과 1 사이의 난수를 반환하는 함수.
     */
    constructor(random = Math.random) {
        this.p = new Uint8Array(256);
        this.perm = new Uint8Array(512);
        this.permMod12 = new Uint8Array(512);

        for (let i = 0; i < 256; i++) {
            this.p[i] = i;
        }

        let n;
        for (let i = 255; i > 0; i--) {
            n = Math.floor((i + 1) * random());
            [this.p[i], this.p[n]] = [this.p[n], this.p[i]];
        }

        for (let i = 0; i < 512; i++) {
            this.perm[i] = this.p[i & 255];
            this.permMod12[i] = this.perm[i] % 12;
        }
    }

    noise2D(x, y) {
        const perm = this.perm;
        const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
        const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
        let n0, n1, n2;
        let s = (x + y) * F2;
        let i = Math.floor(x + s);
        let j = Math.floor(y + s);
        let t = (i + j) * G2;
        let X0 = i - t;
        let Y0 = j - t;
        let x0 = x - X0;
        let y0 = y - Y0;

        let i1, j1;
        if (x0 > y0) {
            i1 = 1; j1 = 0;
        } else {
            i1 = 0; j1 = 1;
        }

        let x1 = x0 - i1 + G2;
        let y1 = y0 - j1 + G2;
        let x2 = x0 - 1.0 + 2.0 * G2;
        let y2 = y0 - 1.0 + 2.0 * G2;

        let ii = i & 255;
        let jj = j & 255;

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) n0 = 0.0;
        else {
            t0 *= t0;
            n0 = t0 * t0 * this.grad(perm[ii + perm[jj]], x0, y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) n1 = 0.0;
        else {
            t1 *= t1;
            n1 = t1 * t1 * this.grad(perm[ii + i1 + perm[jj + j1]], x1, y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) n2 = 0.0;
        else {
            t2 *= t2;
            n2 = t2 * t2 * this.grad(perm[ii + 1 + perm[jj + 1]], x2, y2);
        }

        return 70.0 * (n0 + n1 + n2);
    }

    grad(hash, x, y) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
}

// --- 전역 변수 및 상수 ---
const canvas = document.getElementById('noise-canvas');
const ctx = canvas.getContext('2d');
const infoText = document.getElementById('info-text');

const PARTICLE_COUNT = 2000;
const PARTICLE_RADIUS = 1;
const NOISE_SCALE = 0.005; // 노이즈 필드의 스케일 (값이 작을수록 부드러운 패턴)
const PARTICLE_SPEED = 2; // 파티클 이동 속도

let particles = [];
let simplex = new SimplexNoise();
let hue = 0; // 색상(hue) 값
let animationFrameId = null; // 애니메이션 프레임 ID 저장
let isAnimating = true;
let infoTextTimeout;

/**
 * 개별 파티클을 정의하는 클래스
 */
class Particle {
    /**
     * Particle 생성자
     * 캔버스 내 무작위 위치에서 파티클을 생성합니다.
     */
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
    }

    /**
     * 파티클의 위치를 업데이트합니다.
     * 노이즈 필드를 기반으로 각도를 계산하고 해당 방향으로 이동합니다.
     */
    update() {
        const angle = simplex.noise2D(this.x * NOISE_SCALE, this.y * NOISE_SCALE) * Math.PI * 2;
        this.x += Math.cos(angle) * PARTICLE_SPEED;
        this.y += Math.sin(angle) * PARTICLE_SPEED;
        this.edges();
    }

    /**
     * 현재 위치에 파티클을 그립니다.
     * HSL 색상 모델과 현재 hue 값을 사용하여 색상을 지정합니다.
     */
    draw() {
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, PARTICLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 화면 경계 처리
     * 파티클이 캔버스 한쪽 끝을 벗어나면 반대쪽 끝에서 다시 나타나게 합니다.
     */
    edges() {
        if (this.x > canvas.width) this.x = 0;
        if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        if (this.y < 0) this.y = canvas.height;
    }
}

/**
 * 캔버스와 파티클을 초기화하는 함수.
 * 브라우저 창 크기가 변경될 때도 호출되어 반응형으로 동작합니다.
 */
function setup() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle());
    }
    // 초기 배경을 검은색으로 설정
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * 애니메이션의 각 프레임을 처리하는 메인 루프 함수.
 */
function animate() {
    // 잔상 효과를 위해 반투명한 검은색 사각형을 덧그립니다.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 무지개 효과를 위해 hue 값을 점진적으로 변경합니다.
    hue = (hue + 0.5) % 360;

    // 모든 파티클의 위치를 업데이트하고 다시 그립니다.
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    animationFrameId = requestAnimationFrame(animate);
}

/**
 * 사용자의 클릭에 따라 애니메이션을 재생하거나 정지합니다.
 */
function toggleAnimation() {
    isAnimating = !isAnimating;
    if (isAnimating) {
        animate();
    } else {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    // 상태가 변경될 때마다 안내 문구를 다시 표시합니다.
    showInfoText();
}

/**
 * 안내 문구를 표시하고 일정 시간 후 자동으로 사라지게 합니다.
 */
function showInfoText() {
    clearTimeout(infoTextTimeout);
    infoText.classList.remove('fade-out');
    infoTextTimeout = setTimeout(() => {
        infoText.classList.add('fade-out');
    }, 2000); // 2초 후 사라짐
}

// --- 초기화 및 이벤트 리스너 설정 ---

// 창 크기가 변경될 때마다 캔버스를 다시 설정합니다.
window.addEventListener('resize', setup);
// 클릭 이벤트를 감지하여 애니메이션을 토글합니다.
window.addEventListener('click', toggleAnimation);

// 초기 설정 함수를 호출합니다.
setup();
// 애니메이션을 시작합니다.
animate();
// 초기 안내 문구를 표시합니다.
showInfoText();
