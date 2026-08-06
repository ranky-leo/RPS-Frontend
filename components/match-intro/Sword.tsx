"use client";

import { forwardRef } from "react";
import type { Group } from "three";

type SwordProps = {
  color: string;
};

const Sword = forwardRef<Group, SwordProps>(function Sword({ color }, ref) {
  return (
    <group ref={ref}>
      <mesh castShadow>
        <cylinderGeometry args={[0.04, 0.06, 2.3, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.8}
          roughness={0.15}
          metalness={0.55}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0, -1.25, 0]} castShadow>
        <boxGeometry args={[0.28, 0.16, 0.18]} />
        <meshStandardMaterial
          color="#0f172a"
          emissive="#1e293b"
          emissiveIntensity={0.35}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      <pointLight color={color} intensity={2.2} distance={2.8} />
    </group>
  );
});

export default Sword;
