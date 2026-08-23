const transition = document.querySelector(".hero-transition");
const main = document.querySelector("main");
const statement = document.querySelector(".statement-section");
const statementTitle = statement.querySelector("h2");
const heroMountain = document.querySelector(".hero-mountain");
const heroHeading = document.querySelector("#hero-title");
const sandCanvas = document.querySelector(".sand-transition-canvas");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const timing = {
  blackPanel: { start: .68, end: .9 },
  statementReveal: { start: .88, end: 1 },
};

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const rangeProgress = (progress, range) => clamp((progress - range.start) / (range.end - range.start));
const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);
const easeInOutSine = (value) => -(Math.cos(Math.PI * value) - 1) / 2;
const easeInOutCubic = (value) => value < .5
  ? 4 * value * value * value
  : 1 - Math.pow(-2 * value + 2, 3) / 2;

const statementLines = [...statementTitle.querySelectorAll("[data-statement-line]")]
  .map((line) => line.textContent.trim());
let statementWordIndex = 0;

statementTitle.innerHTML = statementLines
  .map((line) => `<span class="statement-line">${line
    .split(/\s+/)
    .map((word) => `<span class="statement-word" style="--word-index:${statementWordIndex++}"><span>${word}</span></span>`)
    .join(" ")}</span>`)
  .join(" ");

const words = [...statement.querySelectorAll(".statement-word > span")];

const platformPillars = document.querySelector(".platform-pillars");

if (platformPillars) {
  if (reducedMotion.matches) {
    platformPillars.classList.add("is-visible");
  } else {
    const platformPillarsObserver = new IntersectionObserver(([entry]) => {
      platformPillars.classList.toggle("is-visible", entry.isIntersecting);
    }, { threshold: .22 });
    platformPillarsObserver.observe(platformPillars);
  }
}

const roadmap = document.querySelector(".roadmap-section");
const roadmapVideo = roadmap?.querySelector(".roadmap-video");

if (roadmapVideo) {
  roadmapVideo.muted = true;
  roadmapVideo.defaultMuted = true;
  roadmapVideo.playsInline = true;

  const ensureRoadmapVideoPlayback = () => {
    if (!roadmapVideo.paused) return;
    roadmapVideo.play().catch(() => {});
  };

  if (roadmapVideo.readyState >= 2) ensureRoadmapVideoPlayback();
  else roadmapVideo.addEventListener("canplay", ensureRoadmapVideoPlayback, { once: true });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) ensureRoadmapVideoPlayback();
  });
}

if (roadmap) {
  if (reducedMotion.matches) {
    roadmap.classList.add("is-visible");
  } else {
    const roadmapObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      roadmap.classList.add("is-visible");
      roadmapObserver.disconnect();
    }, { threshold: .1 });
    roadmapObserver.observe(roadmap);
  }
}

const sectors = document.querySelector(".sectors-section");

if (sectors) {
  const sectorPanels = [...sectors.querySelectorAll(".sectors-panel")];
  const sectorHeadings = [...sectors.querySelectorAll(".sectors-product-heading")];
  let activeSectorHeading = 0;

  const setActiveSectorHeading = (nextIndex) => {
    if (nextIndex === activeSectorHeading) return;
    activeSectorHeading = nextIndex;
    sectorHeadings.forEach((heading, index) => {
      const isActive = index === nextIndex;
      heading.classList.toggle("is-active", isActive);
      heading.setAttribute("aria-hidden", isActive ? "false" : "true");
    });
  };

  if (reducedMotion.matches) {
    sectors.classList.add("is-visible");
  } else {
    const sectorsObserver = new IntersectionObserver(([entry]) => {
      sectors.classList.toggle("is-visible", entry.isIntersecting);
    }, { threshold: .06 });
    sectorsObserver.observe(sectors);

    let sectorsFrame = null;

    const renderSectors = () => {
      sectorsFrame = null;
      const rect = sectors.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const progress = clamp(-rect.top / travel);
      const transitionCount = Math.max(1, sectorPanels.length - 1);
      const nextHeading = Math.min(sectorHeadings.length - 1, Math.floor(progress * transitionCount + .5));

      setActiveSectorHeading(nextHeading);

      sectorPanels.forEach((panel, index) => {
        const wipe = index < transitionCount
          ? easeInOutCubic(clamp(progress * transitionCount - index))
          : 0;
        panel.style.setProperty("--panel-wipe", wipe.toFixed(4));
        panel.setAttribute("aria-hidden", index < transitionCount && wipe > .985 ? "true" : "false");
      });
    };

    const requestSectorsFrame = () => {
      if (sectorsFrame === null) sectorsFrame = requestAnimationFrame(renderSectors);
    };

    window.addEventListener("scroll", requestSectorsFrame, { passive: true });
    window.addEventListener("resize", requestSectorsFrame, { passive: true });
    requestSectorsFrame();
  }
}

const principles = document.querySelector(".principles-transition");

if (principles && !reducedMotion.matches) {
  const principleNumbers = [...principles.querySelectorAll(".principles-number")];
  const principlePaths = [...principles.querySelectorAll(".principles-spoke-group path")];
  const titleGroups = [...principles.querySelectorAll(".principles-state")]
    .map((title) => [...title.querySelectorAll("b")]);
  const detailGroups = [...principles.querySelectorAll(".principles-detail")]
    .map((detail) => [...detail.querySelectorAll("b")]);
  const radial = principles.querySelector(".principles-radial");
  let principlesFrame = null;
  let currentAngle = 0;
  let numberAngle = 0;
  let curve = 0;
  let lastScrollY = window.scrollY;
  let lastTimestamp = performance.now();
  let titleState = -1;
  let titleAnimations = [];

  const titleDuration = 1109;
  const titleStagger = 162;
  const titleOverlap = 324;
  const titleEase = "cubic-bezier(.17,.84,.44,1)";

  const setTitleState = (nextState, animate = true) => {
    if (nextState === titleState && animate) return;
    const previousState = titleState;
    const direction = previousState < 0 || nextState > previousState ? 1 : -1;
    const allAnimatedLines = [...titleGroups.flat(), ...detailGroups.flat()];
    const currentTransforms = allAnimatedLines.map((line) => getComputedStyle(line).transform);
    titleState = nextState;
    titleAnimations.forEach((animation) => animation.cancel());
    titleAnimations = [];
    allAnimatedLines.forEach((line, index) => {
      line.style.transform = currentTransforms[index] === "none" ? "translateY(0%)" : currentTransforms[index];
    });
    principles.classList.toggle("is-dark", nextState === 1);

    const animateLines = (lines, target, baseDelay, start = null) => {
      lines.forEach((line, index) => {
        if (start !== null) line.style.transform = `translateY(${start})`;
        if (!animate) {
          line.style.transform = `translateY(${target})`;
          return;
        }
        const animation = line.animate(
          [{ transform: getComputedStyle(line).transform }, { transform: `translateY(${target})` }],
          {
            duration: titleDuration,
            delay: baseDelay + index * titleStagger,
            easing: titleEase,
            fill: "forwards",
          },
        );
        animation.onfinish = () => { line.style.transform = `translateY(${target})`; };
        titleAnimations.push(animation);
      });
    };

    if (!animate) {
      titleGroups.forEach((group, index) => animateLines(group, index === nextState ? "0%" : "118%", 0));
      detailGroups.forEach((group, index) => animateLines(group, index === nextState ? "0%" : "118%", 0));
      return;
    }

    titleGroups.forEach((group, index) => {
      if (index !== previousState && index !== nextState) {
        group.forEach((line) => { line.style.transform = "translateY(118%)"; });
      }
    });
    detailGroups.forEach((group, index) => {
      if (index !== previousState && index !== nextState) {
        group.forEach((line) => { line.style.transform = "translateY(118%)"; });
      }
    });

    const outgoingTarget = direction > 0 ? "-118%" : "118%";
    const incomingStart = direction > 0 ? "118%" : "-118%";
    if (previousState >= 0) {
      animateLines(titleGroups[previousState], outgoingTarget, 0);
      animateLines(detailGroups[previousState], outgoingTarget, 0);
    }
    animateLines(titleGroups[nextState], "0%", titleOverlap, incomingStart);
    animateLines(detailGroups[nextState], "0%", titleOverlap + titleStagger, incomingStart);
  };

  const buildPath = (index) => {
    const center = 456.5;
    const angle = Math.PI / 2 - index * (Math.PI / 4) + currentAngle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const points = [`M${center},${center}`];

    for (let step = 1; step <= 16; step += 1) {
      const unit = step / 16;
      const curveWeight = Math.sin(unit * unit * unit * Math.PI);
      const distance = unit * center;
      const bend = curveWeight * curve * center;
      const x = center + cos * distance - sin * bend;
      const y = center - (sin * distance + cos * bend);
      points.push(`L${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`);
    }

    return points.join(" ");
  };

  const renderPrinciples = (timestamp) => {
    const rect = principles.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const targetAngle = clamp((viewportHeight - rect.top) / (rect.height + viewportHeight)) * Math.PI;
    const deltaRatio = Math.min(4, Math.max(.25, (timestamp - lastTimestamp) / (1000 / 60)));
    const angleEase = 1 - Math.pow(.9, deltaRatio);
    currentAngle += (targetAngle - currentAngle) * angleEase;
    numberAngle += (currentAngle - numberAngle) * .28;

    const elapsed = Math.max(16, timestamp - lastTimestamp);
    const velocity = ((window.scrollY - lastScrollY) / elapsed) * 1000;
    const targetCurve = clamp(velocity / 8000, -1, 1) * .2;
    curve += (targetCurve - curve) * .18;
    if (Math.abs(targetCurve) < .0001 && Math.abs(curve) < .0001) curve = 0;
    lastScrollY = window.scrollY;
    lastTimestamp = timestamp;

    const radius = radial.offsetWidth * .53;

    principleNumbers.forEach((number, index) => {
      const angle = Math.PI / 2 - index * (Math.PI / 4) + numberAngle;
      const x = Math.cos(angle) * radius;
      const y = -Math.sin(angle) * radius;
      number.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    });

    principlePaths.forEach((path, index) => path.setAttribute("d", buildPath(index)));
    const stickyTravel = Math.max(1, rect.height - viewportHeight);
    const stickyProgress = clamp(-rect.top / stickyTravel);
    const nextState = stickyProgress < .335 ? 0 : stickyProgress < .67 ? 1 : 2;
    setTitleState(nextState);

    if (rect.bottom > 0 && rect.top < viewportHeight) {
      principlesFrame = requestAnimationFrame(renderPrinciples);
    } else {
      principlesFrame = null;
    }
  };

  const requestPrinciplesFrame = () => {
    if (principlesFrame === null) {
      lastScrollY = window.scrollY;
      lastTimestamp = performance.now();
      principlesFrame = requestAnimationFrame(renderPrinciples);
    }
  };

  window.addEventListener("scroll", requestPrinciplesFrame, { passive: true });
  window.addEventListener("resize", requestPrinciplesFrame, { passive: true });
  const initialRect = principles.getBoundingClientRect();
  const initialProgress = clamp(-initialRect.top / Math.max(1, initialRect.height - window.innerHeight));
  setTitleState(initialProgress < .335 ? 0 : initialProgress < .67 ? 1 : 2, false);
  requestPrinciplesFrame();
}

const createSandRenderer = () => {
  if (!sandCanvas || !heroMountain) return { resize() {}, draw() {} };
  const gl = sandCanvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
  });
  if (!gl) return { resize() {}, draw() {} };

  const vertexShaderSource = `
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    varying vec2 vUv;

    uniform sampler2D textureA;
    uniform sampler2D textureB;
    uniform sampler2D maskField;
    uniform float uMountainProgress;
    uniform float uSpreadProgress;
    uniform float uResolveProgress;
    uniform float effectFactor;

    float rand(vec2 n) {
      return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 ip = floor(p);
      vec2 u = fract(p);
      u = u * u * (3.0 - 2.0 * u);

      float res = mix(
        mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
        mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x),
        u.y
      );
      return res * res;
    }

    void main() {
      vec2 uv = vUv;
      float noiseFactor = noise(gl_FragCoord.xy * 0.4);
      vec2 field = texture2D(maskField, uv).rg;
      float mountainMask = field.r;
      float distanceFromMountain = field.g;
      float distortionReach = 1.0 - smoothstep(0.0, 0.34, distanceFromMountain);
      float distortionProgress = uMountainProgress * 0.72 + uSpreadProgress * 0.28;

      vec2 distortedPosition = vec2(
        uv.x + distortionProgress * noiseFactor * effectFactor * distortionReach,
        uv.y
      );
      vec2 distortedPosition2 = vec2(
        uv.x - (1.0 - distortionProgress) * noiseFactor * effectFactor,
        uv.y
      );
      vec4 textureAColor = texture2D(textureA, distortedPosition);
      vec4 textureBColor = texture2D(textureB, distortedPosition2);

      float mountainBreakup = mountainMask * smoothstep(
        noiseFactor - 0.22,
        noiseFactor + 0.22,
        uMountainProgress
      ) * smoothstep(0.0, 0.02, uMountainProgress);
      float spreadRadius = uSpreadProgress * 1.18 - 0.10 + uResolveProgress * 0.14;
      float grainStrength = mix(0.16, 0.012, uResolveProgress);
      float granularDistance = distanceFromMountain + (noiseFactor - 0.5) * grainStrength;
      float edgeWidth = mix(0.055, 0.008, uResolveProgress);
      float spreadCoverage = 1.0 - smoothstep(
        spreadRadius - edgeWidth,
        spreadRadius + edgeWidth,
        granularDistance
      );
      spreadCoverage *= smoothstep(0.0, 0.02, uSpreadProgress);
      float blackCoverage = max(mountainBreakup, spreadCoverage);

      gl_FragColor = mix(textureAColor, textureBColor, blackCoverage);
    }
  `;

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) return { resize() {}, draw() {} };

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return { resize() {}, draw() {} };

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 2, 0, 0, 2]), gl.STATIC_DRAW);

  const createTexture = () => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  };

  const textureA = createTexture();
  const textureB = createTexture();
  const maskFieldTexture = createTexture();
  const sceneCanvas = document.createElement("canvas");
  const sceneContext = sceneCanvas.getContext("2d");
  const maskCanvas = document.createElement("canvas");
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
  let pixelRatio = 1;
  let isReady = false;
  let lastState = { mountain: 0, spread: 0, resolve: 0 };

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const positionLocation = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  const uvLocation = gl.getAttribLocation(program, "uv");
  gl.enableVertexAttribArray(uvLocation);
  gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(gl.getUniformLocation(program, "textureA"), 0);
  gl.uniform1i(gl.getUniformLocation(program, "textureB"), 1);
  gl.uniform1i(gl.getUniformLocation(program, "maskField"), 2);
  gl.uniform1f(gl.getUniformLocation(program, "effectFactor"), .75);
  const mountainProgressLocation = gl.getUniformLocation(program, "uMountainProgress");
  const spreadProgressLocation = gl.getUniformLocation(program, "uSpreadProgress");
  const resolveProgressLocation = gl.getUniformLocation(program, "uResolveProgress");

  const buildMaskField = (canvasBounds, mountainBounds) => {
    const fieldWidth = Math.max(120, Math.min(280, Math.round(canvasBounds.width * .24)));
    const fieldHeight = Math.max(90, Math.round(fieldWidth * canvasBounds.height / canvasBounds.width));
    const scaleX = fieldWidth / canvasBounds.width;
    const scaleY = fieldHeight / canvasBounds.height;
    maskCanvas.width = fieldWidth;
    maskCanvas.height = fieldHeight;
    maskContext.clearRect(0, 0, fieldWidth, fieldHeight);
    maskContext.drawImage(
      heroMountain,
      (mountainBounds.left - canvasBounds.left) * scaleX,
      (mountainBounds.top - canvasBounds.top) * scaleY,
      mountainBounds.width * scaleX,
      mountainBounds.height * scaleY,
    );

    const image = maskContext.getImageData(0, 0, fieldWidth, fieldHeight);
    const distances = new Float32Array(fieldWidth * fieldHeight);
    const diagonal = Math.SQRT2;
    const infinity = 1e6;

    for (let index = 0; index < distances.length; index += 1) {
      distances[index] = image.data[index * 4 + 3] > 20 ? 0 : infinity;
    }

    for (let y = 0; y < fieldHeight; y += 1) {
      for (let x = 0; x < fieldWidth; x += 1) {
        const index = y * fieldWidth + x;
        let value = distances[index];
        if (x > 0) value = Math.min(value, distances[index - 1] + 1);
        if (y > 0) value = Math.min(value, distances[index - fieldWidth] + 1);
        if (x > 0 && y > 0) value = Math.min(value, distances[index - fieldWidth - 1] + diagonal);
        if (x + 1 < fieldWidth && y > 0) value = Math.min(value, distances[index - fieldWidth + 1] + diagonal);
        distances[index] = value;
      }
    }

    for (let y = fieldHeight - 1; y >= 0; y -= 1) {
      for (let x = fieldWidth - 1; x >= 0; x -= 1) {
        const index = y * fieldWidth + x;
        let value = distances[index];
        if (x + 1 < fieldWidth) value = Math.min(value, distances[index + 1] + 1);
        if (y + 1 < fieldHeight) value = Math.min(value, distances[index + fieldWidth] + 1);
        if (x + 1 < fieldWidth && y + 1 < fieldHeight) value = Math.min(value, distances[index + fieldWidth + 1] + diagonal);
        if (x > 0 && y + 1 < fieldHeight) value = Math.min(value, distances[index + fieldWidth - 1] + diagonal);
        distances[index] = value;
      }
    }

    let maximumDistance = 1;
    for (let index = 0; index < distances.length; index += 1) {
      if (distances[index] < infinity) maximumDistance = Math.max(maximumDistance, distances[index]);
    }

    const fieldImage = maskContext.createImageData(fieldWidth, fieldHeight);
    for (let index = 0; index < distances.length; index += 1) {
      const offset = index * 4;
      fieldImage.data[offset] = image.data[offset + 3];
      fieldImage.data[offset + 1] = Math.round(clamp(distances[index] / maximumDistance) * 255);
      fieldImage.data[offset + 2] = 0;
      fieldImage.data[offset + 3] = 255;
    }
    maskContext.putImageData(fieldImage, 0, 0);
  };

  const uploadScenes = () => {
    if (!heroMountain.naturalWidth || !heroMountain.naturalHeight) return;
    const canvasBounds = sandCanvas.getBoundingClientRect();
    const mountainBounds = heroMountain.getBoundingClientRect();
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    sandCanvas.width = Math.max(1, Math.round(canvasBounds.width * pixelRatio));
    sandCanvas.height = Math.max(1, Math.round(canvasBounds.height * pixelRatio));
    sceneCanvas.width = sandCanvas.width;
    sceneCanvas.height = sandCanvas.height;

    sceneContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    sceneContext.fillStyle = "#f9f9f9";
    sceneContext.fillRect(0, 0, canvasBounds.width, canvasBounds.height);
    sceneContext.drawImage(
      heroMountain,
      mountainBounds.left - canvasBounds.left,
      mountainBounds.top - canvasBounds.top,
      mountainBounds.width,
      mountainBounds.height,
    );
    buildMaskField(canvasBounds, mountainBounds);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureA);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sceneCanvas);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textureB);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([5, 6, 9, 255]),
    );
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, maskFieldTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);
    gl.viewport(0, 0, sandCanvas.width, sandCanvas.height);
    isReady = true;
    main.classList.add("is-sand-ready");
  };

  const draw = (state) => {
    lastState = state;
    if (!isReady) return;
    gl.useProgram(program);
    gl.uniform1f(mountainProgressLocation, state.mountain);
    gl.uniform1f(spreadProgressLocation, state.spread);
    gl.uniform1f(resolveProgressLocation, state.resolve);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const resize = () => {
    uploadScenes();
    draw(lastState);
  };

  const initialize = () => {
    uploadScenes();
    draw(lastState);
  };

  if (heroMountain.complete) initialize();
  else heroMountain.addEventListener("load", initialize, { once: true });
  return { resize, draw };
};

const createHoverNoiseRenderer = () => {
  if (!sandCanvas || !heroMountain || !heroHeading) {
    return { resize() {}, setEnabled() {} };
  }

  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (!canHover.matches) return { resize() {}, setEnabled() {} };

  const gl = sandCanvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
  });
  if (!gl) return { resize() {}, setEnabled() {} };

  const vertexShaderSource = `
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    varying vec2 vUv;

    uniform sampler2D sceneTexture;
    uniform vec3 uTrail[10];
    uniform float uAspect;
    uniform float uRadius;
    uniform float uFeather;
    uniform float uTime;
    uniform float effectFactor;

    float rand(vec2 n) {
      return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 ip = floor(p);
      vec2 u = fract(p);
      u = u * u * (3.0 - 2.0 * u);
      float res = mix(
        mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
        mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x),
        u.y
      );
      return res * res;
    }

    void main() {
      float activeField = 0.0;
      for (int i = 0; i < 10; i++) {
        vec2 delta = vUv - uTrail[i].xy;
        delta.x *= uAspect;
        float pointRadius = uRadius * mix(0.55, 1.0, uTrail[i].z);
        float pointField = 1.0 - smoothstep(
          max(0.0, pointRadius - uFeather),
          pointRadius,
          length(delta)
        );
        activeField = max(activeField, pointField * uTrail[i].z);
      }

      float noiseFactor = noise(gl_FragCoord.xy * 0.4 + vec2(uTime * 8.0, 0.0));

      vec2 distortedPosition = vec2(
        vUv.x + activeField * (noiseFactor - 0.15) * effectFactor * 0.035,
        vUv.y + activeField * (noiseFactor - 0.5) * effectFactor * 0.012
      );
      vec4 sceneColor = texture2D(sceneTexture, distortedPosition);
      float darkGrain = smoothstep(0.54, 0.92, noiseFactor) * activeField;
      vec3 granularColor = mix(sceneColor.rgb, vec3(0.02, 0.022, 0.03), darkGrain * 0.58);
      float granularAlpha = activeField * mix(0.32, 0.76, noiseFactor);

      gl_FragColor = vec4(granularColor, granularAlpha);
    }
  `;

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) return { resize() {}, setEnabled() {} };

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return { resize() {}, setEnabled() {} };
  }

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const positionLocation = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 2, 0, 0, 2]), gl.STATIC_DRAW);
  const uvLocation = gl.getAttribLocation(program, "uv");
  gl.enableVertexAttribArray(uvLocation);
  gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);

  const sceneTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const sceneCanvas = document.createElement("canvas");
  const sceneContext = sceneCanvas.getContext("2d");
  const hitCanvas = document.createElement("canvas");
  const hitContext = hitCanvas.getContext("2d", { willReadFrequently: true });
  const stage = sandCanvas.parentElement;
  let mountainHitPixels = null;
  let mountainHitWidth = 0;
  let mountainHitHeight = 0;
  let canvasBounds = null;
  let mountainBounds = null;
  let headingBounds = null;
  let isReady = false;
  let isEnabled = true;
  let animationFrame = null;
  let lastFrameTime = 0;
  let lastTrailPoint = null;
  const trail = [];
  const trailUniformData = new Float32Array(30);

  gl.useProgram(program);
  gl.uniform1i(gl.getUniformLocation(program, "sceneTexture"), 0);
  gl.uniform1f(gl.getUniformLocation(program, "effectFactor"), .75);
  const trailLocation = gl.getUniformLocation(program, "uTrail[0]");
  const aspectLocation = gl.getUniformLocation(program, "uAspect");
  const radiusLocation = gl.getUniformLocation(program, "uRadius");
  const featherLocation = gl.getUniformLocation(program, "uFeather");
  const timeLocation = gl.getUniformLocation(program, "uTime");

  const buildHitMask = () => {
    mountainHitWidth = 320;
    mountainHitHeight = Math.max(1, Math.round(
      mountainHitWidth * heroMountain.naturalHeight / heroMountain.naturalWidth,
    ));
    hitCanvas.width = mountainHitWidth;
    hitCanvas.height = mountainHitHeight;
    hitContext.clearRect(0, 0, mountainHitWidth, mountainHitHeight);
    hitContext.drawImage(heroMountain, 0, 0, mountainHitWidth, mountainHitHeight);
    mountainHitPixels = hitContext.getImageData(
      0,
      0,
      mountainHitWidth,
      mountainHitHeight,
    ).data;
  };

  const drawHeadingIntoScene = () => {
    const headingStyle = getComputedStyle(heroHeading);
    const headingRect = heroHeading.getBoundingClientRect();
    const secondLine = heroHeading.querySelector("span");
    const secondLineRect = secondLine.getBoundingClientRect();
    const firstLine = [...heroHeading.childNodes]
      .find((node) => node.nodeType === Node.TEXT_NODE)?.textContent.trim() || "Context is";

    sceneContext.fillStyle = headingStyle.color;
    sceneContext.font = `${headingStyle.fontWeight} ${headingStyle.fontSize} ${headingStyle.fontFamily}`;
    sceneContext.textBaseline = "top";
    if ("letterSpacing" in sceneContext) sceneContext.letterSpacing = headingStyle.letterSpacing;
    sceneContext.fillText(
      firstLine,
      headingRect.left - canvasBounds.left,
      headingRect.top - canvasBounds.top,
    );
    sceneContext.fillText(
      secondLine.textContent.trim(),
      secondLineRect.left - canvasBounds.left,
      secondLineRect.top - canvasBounds.top,
    );
  };

  const uploadScene = () => {
    if (!heroMountain.naturalWidth || !heroMountain.naturalHeight) return;
    canvasBounds = sandCanvas.getBoundingClientRect();
    mountainBounds = heroMountain.getBoundingClientRect();
    headingBounds = heroHeading.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    sandCanvas.width = Math.max(1, Math.round(canvasBounds.width * pixelRatio));
    sandCanvas.height = Math.max(1, Math.round(canvasBounds.height * pixelRatio));
    sceneCanvas.width = sandCanvas.width;
    sceneCanvas.height = sandCanvas.height;

    sceneContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    sceneContext.fillStyle = "#f9f9f9";
    sceneContext.fillRect(0, 0, canvasBounds.width, canvasBounds.height);
    sceneContext.drawImage(
      heroMountain,
      mountainBounds.left - canvasBounds.left,
      mountainBounds.top - canvasBounds.top,
      mountainBounds.width,
      mountainBounds.height,
    );
    drawHeadingIntoScene();
    buildHitMask();

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sceneCanvas);
    gl.viewport(0, 0, sandCanvas.width, sandCanvas.height);
    gl.clearColor(0, 0, 0, 0);
    isReady = true;
  };

  const isMountainPixel = (clientX, clientY) => {
    if (!mountainHitPixels || !mountainBounds) return false;
    const u = (clientX - mountainBounds.left) / mountainBounds.width;
    const v = (clientY - mountainBounds.top) / mountainBounds.height;
    if (u < 0 || u > 1 || v < 0 || v > 1) return false;
    const x = Math.min(mountainHitWidth - 1, Math.floor(u * mountainHitWidth));
    const y = Math.min(mountainHitHeight - 1, Math.floor(v * mountainHitHeight));
    return mountainHitPixels[(y * mountainHitWidth + x) * 4 + 3] > 28;
  };

  const isHeadingPixel = (clientX, clientY) => clientX >= headingBounds.left
    && clientX <= headingBounds.right
    && clientY >= headingBounds.top
    && clientY <= headingBounds.bottom;

  const draw = (timestamp) => {
    animationFrame = null;
    if (!isReady) return;
    const frameScale = lastFrameTime
      ? Math.min(3, (timestamp - lastFrameTime) / (1000 / 60))
      : 1;
    lastFrameTime = timestamp;
    const decay = Math.pow(.84, frameScale);
    trail.forEach((point) => { point.life *= decay; });
    while (trail.length && trail[trail.length - 1].life < .012) trail.pop();

    gl.clear(gl.COLOR_BUFFER_BIT);
    if (trail.length) {
      trailUniformData.fill(0);
      trail.forEach((point, index) => {
        const offset = index * 3;
        trailUniformData[offset] = point.x;
        trailUniformData[offset + 1] = point.y;
        trailUniformData[offset + 2] = point.life;
      });
      const radiusPixels = window.innerWidth <= 760 ? 22 : 30;
      const radius = radiusPixels / Math.max(1, canvasBounds.height);
      gl.useProgram(program);
      gl.uniform3fv(trailLocation, trailUniformData);
      gl.uniform1f(aspectLocation, canvasBounds.width / canvasBounds.height);
      gl.uniform1f(radiusLocation, radius);
      gl.uniform1f(featherLocation, Math.min(radius * .38, 11 / canvasBounds.height));
      gl.uniform1f(timeLocation, timestamp / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    if (trail.length) {
      animationFrame = requestAnimationFrame(draw);
    } else {
      lastFrameTime = 0;
    }
  };

  const requestDraw = () => {
    if (animationFrame === null) animationFrame = requestAnimationFrame(draw);
  };

  const onPointerMove = (event) => {
    if (!isReady || !isEnabled || event.pointerType === "touch") return;
    const isActive = isHeadingPixel(event.clientX, event.clientY)
      || isMountainPixel(event.clientX, event.clientY);
    if (!isActive) {
      lastTrailPoint = null;
      requestDraw();
      return;
    }

    const nextPoint = {
      x: clamp((event.clientX - canvasBounds.left) / canvasBounds.width),
      y: 1 - clamp((event.clientY - canvasBounds.top) / canvasBounds.height),
      clientX: event.clientX,
      clientY: event.clientY,
      life: 1,
    };

    if (lastTrailPoint) {
      const distance = Math.hypot(
        event.clientX - lastTrailPoint.clientX,
        event.clientY - lastTrailPoint.clientY,
      );
      if (distance < 7) return;
      const steps = Math.min(3, Math.max(1, Math.ceil(distance / 22)));
      for (let step = 1; step < steps; step += 1) {
        const amount = step / steps;
        trail.unshift({
          x: lastTrailPoint.x + (nextPoint.x - lastTrailPoint.x) * amount,
          y: lastTrailPoint.y + (nextPoint.y - lastTrailPoint.y) * amount,
          life: .72 + amount * .2,
        });
      }
    }
    trail.unshift(nextPoint);
    trail.length = Math.min(trail.length, 10);
    lastTrailPoint = nextPoint;
    requestDraw();
  };

  const onPointerLeave = () => {
    lastTrailPoint = null;
    requestDraw();
  };

  stage.addEventListener("pointermove", onPointerMove, { passive: true });
  stage.addEventListener("pointerleave", onPointerLeave, { passive: true });

  const resize = () => {
    uploadScene();
    requestDraw();
  };

  const setEnabled = (enabled) => {
    isEnabled = enabled;
    if (!enabled) {
      lastTrailPoint = null;
      trail.length = 0;
    }
    requestDraw();
  };

  const initialize = () => uploadScene();
  if (heroMountain.complete) document.fonts.ready.then(initialize);
  else heroMountain.addEventListener("load", () => document.fonts.ready.then(initialize), { once: true });
  return { resize, setEnabled };
};

if (!reducedMotion.matches) {
  const hoverNoise = createHoverNoiseRenderer();
  let sceneProgress = 0;
  let frame = null;
  let needsMeasure = true;
  let transitionTop = 0;
  let transitionDistance = 1;

  const measure = () => {
    const rect = transition.getBoundingClientRect();
    transitionTop = window.scrollY + rect.top;
    transitionDistance = Math.max(1, transition.offsetHeight - window.innerHeight);
    needsMeasure = false;
  };

  const render = () => {
    frame = null;
    if (needsMeasure) measure();

    sceneProgress = clamp((window.scrollY - transitionTop) / transitionDistance);
    const blackPanel = easeInOutCubic(rangeProgress(sceneProgress, timing.blackPanel));
    const statementReveal = easeOutCubic(rangeProgress(sceneProgress, timing.statementReveal));

    main.style.setProperty("--scene-progress", sceneProgress.toFixed(4));
    main.style.setProperty("--hero-copy-y", "0vh");
    main.style.setProperty("--hero-opacity", "1");
    main.style.setProperty("--black-panel-y", `${((1 - blackPanel) * 100).toFixed(3)}%`);
    main.style.setProperty("--mountain-scene-opacity", "1");
    main.style.setProperty("--statement-opacity", statementReveal.toFixed(4));
    main.style.setProperty("--mountain-scale", "1.015");
    main.style.setProperty("--mountain-scroll-x", "0vw");
    main.style.setProperty("--mountain-scroll-y", "0vh");
    hoverNoise.setEnabled(sceneProgress < timing.blackPanel.start);

    words.forEach((word, index) => {
      const stagger = index * .025;
      const reveal = easeOutCubic(clamp((statementReveal - stagger) / Math.max(.001, 1 - stagger)));
      word.style.opacity = (.08 + reveal * .92).toFixed(3);
      word.style.transform = `translateY(${((1 - reveal) * 105).toFixed(2)}%)`;
    });

  };

  const requestFrame = () => {
    if (frame === null) frame = requestAnimationFrame(render);
  };

  window.addEventListener("scroll", requestFrame, { passive: true });

  window.addEventListener("resize", () => {
    needsMeasure = true;
    hoverNoise.resize();
    requestFrame();
  }, { passive: true });

  requestFrame();
}
