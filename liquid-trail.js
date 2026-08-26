(() => {
  "use strict";

  const root = document.querySelector("[data-liquid-backdrop]");
  const canvas = root?.querySelector(".liquid-backdrop__canvas");
  const hero = root?.closest(".figma-hero");
  const mountain = hero?.querySelector(".hero-mountain");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!root || !canvas || !hero || !mountain || !finePointer.matches || reducedMotion.matches) return;

  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  });

  if (!gl) return;

  const VERTEX_SHADER = `#version 300 es
    in vec2 a_position;
    out vec2 v_uv;
    void main() {
      v_uv = 0.5 * (a_position + 1.0);
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const PAINT_SHADER = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_previous_paint;
    uniform sampler2D u_low_paint;
    uniform vec2 u_paint_texel_size;
    uniform vec4 u_draw_from;
    uniform vec4 u_draw_to;
    uniform vec2 u_velocity;
    uniform vec3 u_dissipations;
    uniform float u_push_strength;
    uniform bool u_draw_enabled;
    out vec4 FragColor;

    vec2 sdSegment(vec2 point, vec2 from, vec2 to) {
      vec2 pointOffset = point - from;
      vec2 segment = to - from;
      float ratio = clamp(dot(pointOffset, segment) / max(dot(segment, segment), 0.00001), 0.0, 1.0);
      return vec2(length(pointOffset - segment * ratio), ratio);
    }

    vec2 hashDirection(vec2 point) {
      vec3 point3 = fract(vec3(point.xyx) * vec3(0.1031, 0.1030, 0.0973));
      point3 += dot(point3, point3.yzx + 33.33);
      return fract((point3.xx + point3.yz) * point3.zy) * 2.0 - 1.0;
    }

    vec3 derivativeNoise(vec2 point) {
      vec2 cell = floor(point);
      vec2 local = fract(point);
      vec2 blend = local * local * local * (local * (local * 6.0 - 15.0) + 10.0);
      vec2 derivative = 30.0 * local * local * (local * (local - 2.0) + 1.0);
      vec2 a = hashDirection(cell);
      vec2 b = hashDirection(cell + vec2(1.0, 0.0));
      vec2 c = hashDirection(cell + vec2(0.0, 1.0));
      vec2 d = hashDirection(cell + vec2(1.0, 1.0));
      float valueA = dot(a, local);
      float valueB = dot(b, local - vec2(1.0, 0.0));
      float valueC = dot(c, local - vec2(0.0, 1.0));
      float valueD = dot(d, local - vec2(1.0));
      return vec3(
        valueA + blend.x * (valueB - valueA) + blend.y * (valueC - valueA)
          + blend.x * blend.y * (valueA - valueB - valueC + valueD),
        a + blend.x * (b - a) + blend.y * (c - a)
          + blend.x * blend.y * (a - b - c + d)
          + derivative * (blend.yx * (valueA - valueB - valueC + valueD)
            + vec2(valueB, valueC) - valueA)
      );
    }

    void main() {
      vec2 segment = sdSegment(gl_FragCoord.xy, u_draw_from.xy, u_draw_to.xy);
      vec2 radiusWeight = mix(u_draw_from.zw, u_draw_to.zw, segment.y);
      float stroke = u_draw_enabled ? 1.0 - smoothstep(-0.01, radiusWeight.x, segment.x) : 0.0;
      vec4 lowData = texture(u_low_paint, v_uv);
      vec2 inverseVelocity = (0.5 - lowData.xy) * u_push_strength;
      vec3 noiseA = derivativeNoise(gl_FragCoord.xy * 0.02 * (1.0 - lowData.xy));
      vec2 noiseB = derivativeNoise(
        gl_FragCoord.xy * 0.02 * (2.0 - lowData.xy * (0.5 + noiseA.x) + noiseA.yz * 0.1)
      ).yz;
      inverseVelocity += noiseB * (lowData.z + lowData.w) * 3.0;
      vec4 data = texture(u_previous_paint, v_uv + inverseVelocity * u_paint_texel_size);
      data.xy -= 0.5;
      vec4 delta = (u_dissipations.xxyz - 1.0) * data;
      delta += vec4(u_velocity * stroke, radiusWeight.yy * stroke);
      data += delta;
      data.xy += 0.5;
      FragColor = clamp(data, vec4(0.0), vec4(1.0));
    }
  `;

  const COPY_SHADER = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_source;
    out vec4 FragColor;
    void main() { FragColor = texture(u_source, v_uv); }
  `;

  const BLUR_SHADER = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_source;
    uniform vec2 u_delta;
    out vec4 FragColor;
    void main() {
      FragColor = texture(u_source, v_uv) * 0.1633;
      FragColor += texture(u_source, v_uv + u_delta) * 0.1531;
      FragColor += texture(u_source, v_uv - u_delta) * 0.1531;
      FragColor += texture(u_source, v_uv + u_delta * 2.0) * 0.12245;
      FragColor += texture(u_source, v_uv - u_delta * 2.0) * 0.12245;
      FragColor += texture(u_source, v_uv + u_delta * 3.0) * 0.0918;
      FragColor += texture(u_source, v_uv - u_delta * 3.0) * 0.0918;
      FragColor += texture(u_source, v_uv + u_delta * 4.0) * 0.051;
      FragColor += texture(u_source, v_uv - u_delta * 4.0) * 0.051;
    }
  `;

  const SCENE_SHADER = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_scene;
    uniform sampler2D u_screen_paint;
    uniform sampler2D u_blue_noise;
    uniform vec2 u_screen_paint_texel_size;
    uniform vec2 u_blue_noise_offset;
    out vec4 FragColor;

    vec3 paintedScene(vec2 uv, out float paintWeight) {
      vec4 paintData = texture(u_screen_paint, uv);
      paintWeight = (paintData.z + paintData.w) * 0.5;
      vec2 paintVelocity = (0.5 - paintData.xy - 0.001) * 2.0 * paintWeight;
      vec2 velocity = paintVelocity * 0.75 * u_screen_paint_texel_size * 5.0;
      vec2 blueNoise = texture(u_blue_noise, gl_FragCoord.xy / 128.0 + u_blue_noise_offset).xy;
      vec2 sampleUv = uv + blueNoise * velocity;
      vec3 colour = vec3(0.0);
      for (int tap = 0; tap < 9; tap++) {
        colour += texture(u_scene, sampleUv).rgb;
        sampleUv += velocity;
      }
      colour /= 9.0;
      vec3 chromaticPaint = sin(
        vec3(paintVelocity.x + paintVelocity.y) * 40.0 + vec3(0.0, 1.0, 2.0)
      );
      colour += chromaticPaint
        * (1.0 - smoothstep(-0.9, 0.4, paintWeight))
        * max(abs(paintVelocity.x), abs(paintVelocity.y))
        * 12.5;
      return colour;
    }

    void main() {
      float paintWeight = 0.0;
      FragColor = vec4(paintedScene(v_uv, paintWeight), 1.0);
    }
  `;

  const resources = { programs: [], textures: [], framebuffers: [], buffers: [], vaos: [] };
  const fail = (message) => {
    console.warn(`[FuturixAI liquid trail] ${message}`);
    hero.classList.remove("is-liquid-ready");
  };

  const compileProgram = (fragmentSource) => {
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || "Shader compilation failed.";
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || "Program linking failed.";
      gl.deleteProgram(program);
      throw new Error(message);
    }
    resources.programs.push(program);
    return program;
  };

  const uniform = (program, name) => gl.getUniformLocation(program, name);
  const bindTexture = (unit, texture, location) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(location, unit);
  };

  let paintProgram;
  let copyProgram;
  let blurProgram;
  let sceneProgram;
  let vao;
  let sceneTexture;
  let blueNoiseTexture;
  let paintTargets = [];
  let lowTargets = [];
  let paintReadIndex = 0;
  let paintWidth = 1;
  let paintHeight = 1;
  let lowPaintWidth = 1;
  let lowPaintHeight = 1;
  let bounds = null;
  let animationFrame = 0;
  let resizeFrame = 0;
  let isVisible = true;
  let isReady = false;
  let disposed = false;
  let previousPointer;
  let paintVelocityX = 0;
  let paintVelocityY = 0;
  let paint = {
    active: false,
    fromX: 0,
    fromY: 0,
    radius: 0,
    toX: 0,
    toY: 0,
    velocityX: 0,
    velocityY: 0,
  };

  const sceneCanvas = document.createElement("canvas");
  const sceneContext = sceneCanvas.getContext("2d");

  const createTarget = (width, height) => {
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    resources.textures.push(texture);
    resources.framebuffers.push(framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("A liquid trail framebuffer is incomplete.");
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.5, 0.5, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture, framebuffer, width, height };
  };

  const createSceneTexture = () => {
    const texture = gl.createTexture();
    resources.textures.push(texture);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([249, 249, 249, 255]));
    return texture;
  };

  const createNoiseTexture = () => {
    const size = 128;
    const data = new Uint8Array(size * size * 4);
    let seed = 0x6d2b79f5;
    const random = () => {
      seed += 0x6d2b79f5;
      let value = seed;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    for (let index = 0; index < data.length; index += 4) {
      data[index] = Math.floor(random() * 256);
      data[index + 1] = Math.floor(random() * 256);
      data[index + 2] = 127;
      data[index + 3] = 255;
    }
    const texture = gl.createTexture();
    resources.textures.push(texture);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return texture;
  };

  const setupGeometry = () => {
    vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    resources.vaos.push(vao);
    resources.buffers.push(buffer);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    [paintProgram, copyProgram, blurProgram, sceneProgram].forEach((program) => {
      const location = gl.getAttribLocation(program, "a_position");
      if (location >= 0) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
      }
    });
  };

  const drawQuad = () => {
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const uploadScene = () => {
    bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !mountain.naturalWidth) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * dpr));
    const height = Math.max(1, Math.round(bounds.height * dpr));
    canvas.width = width;
    canvas.height = height;
    sceneCanvas.width = width;
    sceneCanvas.height = height;
    sceneContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    sceneContext.fillStyle = "#f9f9f9";
    sceneContext.fillRect(0, 0, bounds.width, bounds.height);
    const mountainBounds = mountain.getBoundingClientRect();
    sceneContext.drawImage(
      mountain,
      mountainBounds.left - bounds.left,
      mountainBounds.top - bounds.top,
      mountainBounds.width,
      mountainBounds.height,
    );
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, sceneCanvas);
    if (gl.getError() !== gl.NO_ERROR) return false;
    paintWidth = Math.max(1, width >> 2);
    paintHeight = Math.max(1, height >> 2);
    lowPaintWidth = Math.max(1, paintWidth >> 1);
    lowPaintHeight = Math.max(1, paintHeight >> 1);
    paintTargets = [createTarget(paintWidth, paintHeight), createTarget(paintWidth, paintHeight)];
    lowTargets = [createTarget(lowPaintWidth, lowPaintHeight), createTarget(lowPaintWidth, lowPaintHeight)];
    paintReadIndex = 0;
    previousPointer = undefined;
    paintVelocityX = 0;
    paintVelocityY = 0;
    return true;
  };

  const setFramebuffer = (target, width, height) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, width, height);
  };

  const renderFrame = () => {
    animationFrame = 0;
    if (!isReady || !isVisible || disposed) return;
    const write = 1 - paintReadIndex;
    const scaleX = paintWidth / bounds.width;
    const scaleY = paintHeight / bounds.height;
    const radius = paint.radius * Math.min(scaleX, scaleY);

    paintVelocityX *= 0.8;
    paintVelocityY *= 0.8;
    if (paint.active) {
      paintVelocityX += paint.velocityX * scaleX * 0.0128;
      paintVelocityY += paint.velocityY * scaleY * 0.0128;
    }

    setFramebuffer(paintTargets[write].framebuffer, paintWidth, paintHeight);
    gl.useProgram(paintProgram);
    bindTexture(1, paintTargets[paintReadIndex].texture, uniform(paintProgram, "u_previous_paint"));
    bindTexture(2, lowTargets[0].texture, uniform(paintProgram, "u_low_paint"));
    gl.uniform2f(uniform(paintProgram, "u_paint_texel_size"), 1 / paintWidth, 1 / paintHeight);
    gl.uniform4f(uniform(paintProgram, "u_draw_from"), paint.fromX * scaleX, paint.fromY * scaleY, radius, 1);
    gl.uniform4f(uniform(paintProgram, "u_draw_to"), paint.toX * scaleX, paint.toY * scaleY, radius, 1);
    gl.uniform2f(uniform(paintProgram, "u_velocity"), paintVelocityX, paintVelocityY);
    gl.uniform3f(uniform(paintProgram, "u_dissipations"), 0.975, 0.95, 0.8);
    gl.uniform1f(uniform(paintProgram, "u_push_strength"), 25);
    gl.uniform1i(uniform(paintProgram, "u_draw_enabled"), paint.active ? 1 : 0);
    drawQuad();
    paintReadIndex = write;

    setFramebuffer(lowTargets[0].framebuffer, lowPaintWidth, lowPaintHeight);
    gl.useProgram(copyProgram);
    bindTexture(1, paintTargets[paintReadIndex].texture, uniform(copyProgram, "u_source"));
    drawQuad();

    setFramebuffer(lowTargets[1].framebuffer, lowPaintWidth, lowPaintHeight);
    gl.useProgram(blurProgram);
    bindTexture(2, lowTargets[0].texture, uniform(blurProgram, "u_source"));
    gl.uniform2f(uniform(blurProgram, "u_delta"), 2 / lowPaintWidth, 0);
    drawQuad();

    setFramebuffer(lowTargets[0].framebuffer, lowPaintWidth, lowPaintHeight);
    bindTexture(2, lowTargets[1].texture, uniform(blurProgram, "u_source"));
    gl.uniform2f(uniform(blurProgram, "u_delta"), 0, 2 / lowPaintHeight);
    drawQuad();

    setFramebuffer(null, canvas.width, canvas.height);
    gl.useProgram(sceneProgram);
    bindTexture(0, sceneTexture, uniform(sceneProgram, "u_scene"));
    bindTexture(1, paintTargets[paintReadIndex].texture, uniform(sceneProgram, "u_screen_paint"));
    bindTexture(3, blueNoiseTexture, uniform(sceneProgram, "u_blue_noise"));
    gl.uniform2f(uniform(sceneProgram, "u_screen_paint_texel_size"), 1 / paintWidth, 1 / paintHeight);
    gl.uniform2f(uniform(sceneProgram, "u_blue_noise_offset"), Math.random() * 0.5, Math.random() * 0.5);
    drawQuad();

    paint.active = false;
    if (!hero.classList.contains("is-liquid-ready")) hero.classList.add("is-liquid-ready");
    animationFrame = requestAnimationFrame(renderFrame);
  };

  const onPointerMove = (event) => {
    if (!bounds) return;
    const current = { x: event.clientX - bounds.left, y: bounds.bottom - event.clientY };
    const previous = previousPointer || current;
    const velocityX = current.x - previous.x;
    const velocityY = current.y - previous.y;
    const distance = Math.hypot(velocityX, velocityY);
    paint = {
      active: Boolean(previousPointer),
      fromX: previous.x,
      fromY: previous.y,
      radius: Math.min(1, distance / 100) * Math.max(40, bounds.width / 20),
      toX: current.x,
      toY: current.y,
      velocityX,
      velocityY,
    };
    previousPointer = current;
  };

  const onPointerLeave = () => {
    previousPointer = undefined;
    paint.active = false;
  };

  const resize = () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      try {
        isReady = uploadScene();
      } catch (error) {
        fail(error.message);
        isReady = false;
      }
    });
  };

  const observer = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
    if (isVisible && isReady && !animationFrame) animationFrame = requestAnimationFrame(renderFrame);
  }, { threshold: 0.01 });

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animationFrame);
    cancelAnimationFrame(resizeFrame);
    observer.disconnect();
    hero.removeEventListener("pointermove", onPointerMove);
    hero.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("resize", resize);
    resources.programs.forEach((resource) => gl.deleteProgram(resource));
    resources.textures.forEach((resource) => gl.deleteTexture(resource));
    resources.framebuffers.forEach((resource) => gl.deleteFramebuffer(resource));
    resources.buffers.forEach((resource) => gl.deleteBuffer(resource));
    resources.vaos.forEach((resource) => gl.deleteVertexArray(resource));
    hero.classList.remove("is-liquid-ready");
  };

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    fail("WebGL context was lost; the static hero fallback remains active.");
    dispose();
  }, { once: true });

  try {
    paintProgram = compileProgram(PAINT_SHADER);
    copyProgram = compileProgram(COPY_SHADER);
    blurProgram = compileProgram(BLUR_SHADER);
    sceneProgram = compileProgram(SCENE_SHADER);
    setupGeometry();
    sceneTexture = createSceneTexture();
    blueNoiseTexture = createNoiseTexture();
    gl.disable(gl.BLEND);
    hero.addEventListener("pointermove", onPointerMove, { passive: true });
    hero.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pagehide", dispose, { once: true });
    observer.observe(hero);
    const initialize = () => {
      try {
        isReady = uploadScene();
        if (isReady && isVisible) animationFrame = requestAnimationFrame(renderFrame);
      } catch (error) {
        fail(error.message);
        dispose();
      }
    };
    if (mountain.complete && mountain.naturalWidth) initialize();
    else mountain.addEventListener("load", initialize, { once: true });
  } catch (error) {
    fail(error.message);
    dispose();
  }
})();
