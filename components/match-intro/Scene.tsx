"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh } from "three";
import Sword from "./Sword";
import Particles from "./Particles";
import CameraRig from "./CameraRig";

type SceneProps = {
  trigger: number;
};

export default function Scene({ trigger }: SceneProps) {
  const leftSwordRef = useRef<Group>(null);
  const rightSwordRef = useRef<Group>(null);
  const leftFlameRef = useRef<Mesh>(null);
  const rightFlameRef = useRef<Mesh>(null);
  const progressRef = useRef(0);
  const collidedRef = useRef(false);

  const [burstSeed, setBurstSeed] = useState(0);
  const [flash, setFlash] = useState(0);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    progressRef.current = 0;
    collidedRef.current = false;
    setFlash(0);
    setShake(0);
  }, [trigger]);

  useFrame((state, delta) => {
    const step = Math.min(1, progressRef.current + delta * 1.55);
    progressRef.current = step;
    const beat = 1 + Math.sin(state.clock.elapsedTime * 18) * 0.12;

    const leftX = -2.55 + step * 2.55;
    const rightX = 2.55 - step * 2.55;

    if (leftSwordRef.current) {
      leftSwordRef.current.position.set(leftX, 0, 0);
      leftSwordRef.current.rotation.set(0.15, 0, 1.2 - step * 1.1);
    }

    if (rightSwordRef.current) {
      rightSwordRef.current.position.set(rightX, 0, 0);
      rightSwordRef.current.rotation.set(-0.15, 0, -1.2 + step * 1.1);
    }

    if (leftFlameRef.current) {
      leftFlameRef.current.position.set(leftX + 0.18, 0.92, 0.08);
      leftFlameRef.current.scale.setScalar(beat * (0.9 + flash * 0.18));
    }

    if (rightFlameRef.current) {
      rightFlameRef.current.position.set(rightX - 0.18, 0.92, 0.08);
      rightFlameRef.current.scale.setScalar(beat * (0.9 + flash * 0.18));
    }

    if (!collidedRef.current && step >= 0.92) {
      collidedRef.current = true;
      setBurstSeed((value) => value + 1);
      setFlash(1);
      setShake(1);
    }

    setFlash((value) => Math.max(0, value - delta * 3.4));
    setShake((value) => Math.max(0, value - delta * 2.2));
  });

  return (
    <>
      <CameraRig shake={shake} />

      <ambientLight intensity={0.2} color="#5f6aa1" />
      <pointLight position={[0, 2, 3]} intensity={0.85} color="#7a8eff" />
      <pointLight
        position={[0, 0, 0.2]}
        intensity={0.45 + flash * 6.5}
        color="#ff9b45"
        distance={8}
      />
      <pointLight
        position={[-1.6, 0.95, 0.2]}
        intensity={2.1}
        color="#ff5a1f"
        distance={3.3}
      />
      <pointLight
        position={[1.6, 0.95, 0.2]}
        intensity={2.1}
        color="#ff5a1f"
        distance={3.3}
      />

      <Sword ref={leftSwordRef} color="#ff8a3d" />
      <Sword ref={rightSwordRef} color="#ff3d7a" />

      <mesh ref={leftFlameRef}>
        <coneGeometry args={[0.18, 0.54, 12]} />
        <meshBasicMaterial
          color="#ff7c2c"
          transparent
          opacity={0.82}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={rightFlameRef}>
        <coneGeometry args={[0.18, 0.54, 12]} />
        <meshBasicMaterial
          color="#ff7c2c"
          transparent
          opacity={0.82}
          depthWrite={false}
        />
      </mesh>

      <Particles burstSeed={burstSeed} count={320} />

      <mesh>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshBasicMaterial
          color="#ffc06a"
          transparent
          opacity={0.1 + flash * 0.34}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.45, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#060912" roughness={0.95} metalness={0} />
      </mesh>
    </>
  );
}
