"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
} from "three";

type ParticlesProps = {
  burstSeed: number;
  count?: number;
};

const VERT = `
attribute vec3 aVelocity;
attribute float aDelay;
uniform float uTime;
uniform float uBurst;
varying float vAlpha;
varying float vHeat;

void main() {
  float age = max(0.0, uTime - uBurst - aDelay);
  float life = 1.2;
  float t = clamp(age / life, 0.0, 1.0);

  vec3 pos = position;
  pos += aVelocity * age;
  pos.y -= age * age * 1.9;

  float alive = step(age, life);
  vAlpha = (1.0 - t) * alive;
  vHeat = 1.0 - t;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = (16.0 * (1.0 - t) + 3.0) * (300.0 / -mvPosition.z) * alive;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAG = `
varying float vAlpha;
varying float vHeat;

void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  float soft = smoothstep(0.52, 0.0, d);
  vec3 hot = vec3(1.0, 0.88, 0.32);
  vec3 warm = vec3(1.0, 0.46, 0.12);
  vec3 ember = vec3(0.8, 0.08, 0.02);
  vec3 col = mix(ember, warm, clamp(vHeat * 1.1, 0.0, 1.0));
  col = mix(col, hot, smoothstep(0.65, 1.0, vHeat));
  gl_FragColor = vec4(col, soft * vAlpha);
}
`;

export default function Particles({ burstSeed, count = 160 }: ParticlesProps) {
  const pointsRef = useRef<Points>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const elapsedRef = useRef(0);

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const delays = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      const i3 = index * 3;
      positions[i3] = 0;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = 0;

      const angle = Math.random() * Math.PI * 2;
      const spread = (Math.random() - 0.5) * 0.8;
      const speed = 2.8 + Math.random() * 4.9;

      velocities[i3] = Math.cos(angle) * speed;
      velocities[i3 + 1] = (1.4 + Math.random() * 2.4) * speed * 0.36;
      velocities[i3 + 2] = (Math.sin(angle) * speed + spread) * 0.5;

      delays[index] = Math.random() * 0.12;
    }

    const bufferGeometry = new BufferGeometry();
    bufferGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    bufferGeometry.setAttribute(
      "aVelocity",
      new BufferAttribute(velocities, 3),
    );
    bufferGeometry.setAttribute("aDelay", new BufferAttribute(delays, 1));

    const shaderMaterial = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uBurst: { value: -999 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    return { geometry: bufferGeometry, material: shaderMaterial };
  }, [count]);

  useEffect(() => {
    if (!materialRef.current) {
      return;
    }
    materialRef.current.uniforms.uBurst.value = elapsedRef.current;
  }, [burstSeed]);

  useFrame((state) => {
    elapsedRef.current = state.clock.elapsedTime;
    if (!materialRef.current) {
      return;
    }
    materialRef.current.uniforms.uTime.value = elapsedRef.current;
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <primitive object={geometry} attach="geometry" />
      <primitive ref={materialRef} object={material} attach="material" />
    </points>
  );
}
