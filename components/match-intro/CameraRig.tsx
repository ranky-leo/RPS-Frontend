"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";

type CameraRigProps = {
  shake: number;
};

export default function CameraRig({ shake }: CameraRigProps) {
  const { camera } = useThree();
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;

    const baseX = 0;
    const baseY = 0.2;
    const baseZ = 6;

    const amount = Math.max(0, shake);
    const waveX = Math.sin(timeRef.current * 65) * 0.04 * amount;
    const waveY = Math.cos(timeRef.current * 80) * 0.03 * amount;

    camera.position.set(baseX + waveX, baseY + waveY, baseZ);
    camera.lookAt(0, 0, 0);
  });

  return null;
}
