(() => {
  const canvas = document.querySelector(".hero-cursor-trail");
  const hero = canvas?.closest(".figma-hero");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!canvas || !hero || reducedMotion.matches) return;

  const vertexSource = `#version 300 es
    in vec2 a_position;
    out vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const injectionSource = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_velocity;
    uniform vec2 u_vector;
    uniform vec2 u_cursor;
    uniform vec2 u_resolution;
    out vec2 FragColor;
    void main() {
      vec2 velocity = texture(u_velocity, v_uv).rg;
      vec2 correction = u_cursor / u_resolution - v_uv;
      correction.x *= u_resolution.x / u_resolution.y;
      float influence = exp(-dot(correction, correction) / (0.025 * 0.025));
      FragColor = velocity + influence * u_vector * 0.04;
    }
  `;

  const decaySource = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_previous;
    uniform float u_delta;
    out vec2 FragColor;
    void main() {
      FragColor = texture(u_previous, v_uv).rg *
        (1.0 - min(0.5, u_delta / 250.0));
    }
  `;

  const displaySource = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_cursor;
    uniform vec2 u_resolution;
    uniform vec3 u_color;
    out vec4 FragColor;

    float checkEqual(float first, float second) {
      return 1.0 - ceil(abs(first - second) / 20.0);
    }

    float drawLogo(vec2 rect, float opacity) {
      float x = mod(round(mod(rect.x, 1.0) * 4.0 + 1.5), 4.0);
      float y = mod(round(mod(rect.y, 1.0) * 4.0 + 0.5), 4.0);
      float progress = 1.0 / 7.0;
      float outputOpacity = 0.0;
      outputOpacity += step(1.0 - opacity, progress * 0.0) * checkEqual(0.0, x) * checkEqual(0.0, y);
      outputOpacity += step(1.0 - opacity, progress * 1.0) * checkEqual(0.0, x) * checkEqual(2.0, y);
      outputOpacity += step(1.0 - opacity, progress * 2.0) * checkEqual(2.0, x) * checkEqual(1.0, y);
      outputOpacity += step(1.0 - opacity, progress * 3.0) * checkEqual(3.0, x) * checkEqual(3.0, y);
      outputOpacity += step(1.0 - opacity, progress * 4.0) * checkEqual(1.0, x) * checkEqual(3.0, y);
      outputOpacity += step(1.0 - opacity, progress * 5.0) * checkEqual(0.0, x) * checkEqual(1.0, y);
      outputOpacity += step(1.0 - opacity, progress * 6.0) * checkEqual(2.0, x) * checkEqual(0.0, y);
      return min(1.0, outputOpacity);
    }

    void main() {
      float columns = u_resolution.x / 6.0;
      float rows = u_resolution.y / 6.0;
      vec2 roundedScreen = vec2(
        round(v_uv.x * columns) / columns,
        round(v_uv.y * rows) / rows
      );
      vec2 velocity = texture(u_cursor, roundedScreen).rg;
      float opacity = drawLogo(
        vec2(v_uv.x * columns, v_uv.y * rows),
        length(velocity)
      );
      FragColor = vec4(u_color * opacity, opacity);
    }
  `;

  const startFallback = () => {
    const context = canvas.getContext("2d");
    if (!context) return;
    const pattern = [[0, 0], [0, 2], [2, 1], [3, 3], [1, 3], [0, 1], [2, 0]];
    const particles = [];
    let width = 1;
    let height = 1;
    let lastPointer;
    let frame = 0;

    const resize = () => {
      const bounds = hero.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now) => {
      frame = 0;
      context.clearRect(0, 0, width, height);
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        const progress = (now - particle.createdAt) / 720;
        if (progress >= 1) {
          particles.splice(index, 1);
          continue;
        }
        const opacity = Math.pow(1 - progress, 1.7);
        context.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        pattern.slice(0, Math.max(1, Math.ceil(opacity * 7))).forEach(([x, y]) => {
          context.fillRect(particle.x + x * 5, particle.y + y * 5, 3, 3);
        });
      }
      if (particles.length) frame = requestAnimationFrame(draw);
    };

    hero.addEventListener("pointermove", (event) => {
      const bounds = hero.getBoundingClientRect();
      const current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      if (!lastPointer) {
        lastPointer = current;
        return;
      }
      const distance = Math.hypot(current.x - lastPointer.x, current.y - lastPointer.y);
      const steps = Math.max(1, Math.ceil(distance / 10));
      const createdAt = performance.now();
      for (let step = 1; step <= steps; step += 1) {
        const progress = step / steps;
        particles.push({
          x: Math.round(lastPointer.x + (current.x - lastPointer.x) * progress),
          y: Math.round(lastPointer.y + (current.y - lastPointer.y) * progress),
          createdAt,
        });
      }
      particles.splice(0, Math.max(0, particles.length - 180));
      lastPointer = current;
      if (!frame) frame = requestAnimationFrame(draw);
    }, { passive: true });

    hero.addEventListener("pointerleave", () => { lastPointer = undefined; });
    window.addEventListener("resize", resize, { passive: true });
    resize();
  };

  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    stencil: false,
  });

  if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
    startFallback();
    return;
  }

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    console.error("Hero trail shader compilation failed:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  };

  const createProgram = (fragmentSource) => {
    const vertex = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return null;
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
    console.error("Hero trail shader linking failed:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  };

  const createField = (width, height) => {
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, width, height, 0, gl.RG, gl.HALF_FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { framebuffer, texture };
  };

  const injectionProgram = createProgram(injectionSource);
  const decayProgram = createProgram(decaySource);
  const displayProgram = createProgram(displaySource);
  const positionBuffer = gl.createBuffer();

  if (!injectionProgram || !decayProgram || !displayProgram || !positionBuffer) return;

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);

  let width = 1;
  let height = 1;
  let fieldWidth = 1;
  let fieldHeight = 1;
  let fields = [];
  let readIndex = 0;
  let lastPointer;
  let lastFrameTime = performance.now();
  let lastCursorTime = 0;
  let frame = 0;
  let running = false;

  const bindProgram = (program) => {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  };

  const bindTexture = (program, uniform) => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fields[readIndex].texture);
    gl.uniform1i(gl.getUniformLocation(program, uniform), 0);
  };

  const deleteFields = () => {
    fields.forEach((field) => {
      gl.deleteFramebuffer(field.framebuffer);
      gl.deleteTexture(field.texture);
    });
    fields = [];
  };

  const resize = () => {
    const bounds = hero.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    width = Math.max(1, Math.round(bounds.width));
    height = Math.max(1, Math.round(bounds.height));
    fieldWidth = Math.max(1, Math.trunc((dpr * width) / 36));
    fieldHeight = Math.max(1, Math.trunc((dpr * height) / 36));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    deleteFields();
    const first = createField(fieldWidth, fieldHeight);
    const second = createField(fieldWidth, fieldHeight);
    if (!first || !second) return;
    fields = [first, second];
    readIndex = 0;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };

  const drawFieldPass = (program, uniform, framebuffer) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, fieldWidth, fieldHeight);
    bindProgram(program);
    bindTexture(program, uniform);
  };

  const inject = (current, vector) => {
    if (fields.length !== 2) return;
    const writeIndex = 1 - readIndex;
    drawFieldPass(injectionProgram, "u_velocity", fields[writeIndex].framebuffer);
    gl.uniform2f(gl.getUniformLocation(injectionProgram, "u_vector"), vector[0], vector[1]);
    gl.uniform2f(gl.getUniformLocation(injectionProgram, "u_cursor"), current[0], current[1]);
    gl.uniform2f(gl.getUniformLocation(injectionProgram, "u_resolution"), width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    readIndex = writeIndex;
  };

  const decay = (delta) => {
    if (fields.length !== 2) return;
    const writeIndex = 1 - readIndex;
    drawFieldPass(decayProgram, "u_previous", fields[writeIndex].framebuffer);
    gl.uniform1f(gl.getUniformLocation(decayProgram, "u_delta"), delta);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    readIndex = writeIndex;
  };

  const display = () => {
    if (fields.length !== 2) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    bindProgram(displayProgram);
    bindTexture(displayProgram, "u_cursor");
    gl.uniform2f(gl.getUniformLocation(displayProgram, "u_resolution"), width, height);
    gl.uniform3f(gl.getUniformLocation(displayProgram, "u_color"), 1, 1, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const render = (now) => {
    if (now - lastCursorTime < 1500) {
      decay(Math.min(50, now - lastFrameTime));
      display();
      frame = requestAnimationFrame(render);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      running = false;
    }
    lastFrameTime = now;
  };

  const wake = () => {
    if (running) return;
    running = true;
    lastFrameTime = performance.now();
    frame = requestAnimationFrame(render);
  };

  hero.addEventListener("pointermove", (event) => {
    const bounds = hero.getBoundingClientRect();
    const current = [event.clientX - bounds.left, bounds.bottom - event.clientY];
    if (!lastPointer) {
      lastPointer = current;
      return;
    }
    const vector = [current[0] - lastPointer[0], current[1] - lastPointer[1]];
    inject(current, vector);
    lastPointer = current;
    lastCursorTime = performance.now();
    wake();
  }, { passive: true });

  hero.addEventListener("pointerleave", () => { lastPointer = undefined; });
  window.addEventListener("resize", resize, { passive: true });
  resize();
})();
