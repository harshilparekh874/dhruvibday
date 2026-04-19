import { useCursor, useTexture } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Euler,
  Group,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from "three";

type BirthdayCardProps = {
  id: string;
  image: string;
  backImage?: string; // added
  tablePosition: [number, number, number];
  tableRotation: [number, number, number];
  isActive: boolean;
  onToggle: (id: string) => void;
  children?: ReactNode;
};

const CARD_SCALE = 0.25;
const CARD_WIDTH = 4 * CARD_SCALE;
const CARD_HEIGHT = 3 * CARD_SCALE;
const CAMERA_DISTANCE = 1.2;
const CAMERA_Y_FLOOR = 0.8;
const HOVER_LIFT = 0.04;

export function BirthdayCard({
  id,
  image,
  backImage, // added
  tablePosition,
  tableRotation,
  isActive,
  onToggle,
  children,
}: BirthdayCardProps) {
  const groupRef = useRef<Group>(null);
  const { camera } = useThree();
  const [isHovered, setIsHovered] = useState(false);

  // --- flipping state (added) ---
  const [isFlipped, setIsFlipped] = useState(false);
  const putDownAfterUnflipRef = useRef(false);
  // -----------------------------

  useCursor(isHovered || isActive, "pointer");

  const texture = useTexture(image);
  const backTexture = useTexture(backImage || image); // fallback to front if no back provided

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
  }, [texture]);

  useEffect(() => {
    if (backTexture) {
      backTexture.colorSpace = SRGBColorSpace;
      backTexture.anisotropy = 4;
    }
  }, [backTexture]);

  const defaultPosition = useMemo(
    () => new Vector3(...tablePosition),
    [tablePosition]
  );
  const defaultQuaternion = useMemo(() => {
    const euler = new Euler(...tableRotation);
    return new Quaternion().setFromEuler(euler);
  }, [tableRotation]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) {
      return;
    }
    group.position.copy(defaultPosition);
    group.quaternion.copy(defaultQuaternion);
  }, [defaultPosition, defaultQuaternion]);

  useEffect(() => {
    if (!isActive) {
      setIsHovered(false);
      setIsFlipped(false);
      putDownAfterUnflipRef.current = false;
    }
  }, [isActive]);

  const tmpPosition = useMemo(() => new Vector3(), []);
  const tmpQuaternion = useMemo(() => new Quaternion(), []);
  const tmpDirection = useMemo(() => new Vector3(), []);
  const cameraOffset = useMemo(() => new Vector3(0, -0.05, 0), []);

  // --- flip quaternion (added) ---
  const flipQuat = useMemo(() => {
    const q = new Quaternion();
    q.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
    return q;
  }, []);
  // ------------------------------

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    const positionTarget = tmpPosition;
    const rotationTarget = tmpQuaternion;

    if (isActive) {
      positionTarget.copy(camera.position);
      positionTarget.add(
        tmpDirection
          .copy(camera.getWorldDirection(tmpDirection))
          .multiplyScalar(CAMERA_DISTANCE)
      );
      positionTarget.add(cameraOffset);
      if (positionTarget.y < CAMERA_Y_FLOOR) {
        positionTarget.y = CAMERA_Y_FLOOR;
      }

      // face the camera, optionally flipped (added)
      rotationTarget.copy(camera.quaternion);
      if (isFlipped) {
        rotationTarget.multiply(flipQuat);
      }
    } else {
      positionTarget.copy(defaultPosition);
      if (isHovered) {
        positionTarget.y += HOVER_LIFT;
      }
      rotationTarget.copy(defaultQuaternion);
    }

    const lerpAlpha = 1 - Math.exp(-delta * 12);
    const slerpAlpha = 1 - Math.exp(-delta * 10);

    group.position.lerp(positionTarget, lerpAlpha);
    group.quaternion.slerp(rotationTarget, slerpAlpha);

    // after unflipping, put it down once it's facing front again (added)
    if (isActive && putDownAfterUnflipRef.current) {
      const facingFront = group.quaternion.angleTo(camera.quaternion) < 0.12;
      if (facingFront) {
        putDownAfterUnflipRef.current = false;
        onToggle(id);
      }
    }
  });

  const handlePointerOver = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      if (!isActive) {
        setIsHovered(true);
      }
    },
    [isActive]
  );

  const handlePointerOut = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setIsHovered(false);
  }, []);

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
  }, []);

  // click logic:
  // 1) if not active -> pick up
  // 2) if active & front -> flip to back
  // 3) if active & back -> flip to front, then put down (added)
  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();

      if (!isActive) {
        setIsFlipped(false);
        putDownAfterUnflipRef.current = false;
        onToggle(id);
        return;
      }

      if (!isFlipped) {
        setIsFlipped(true);
        return;
      }

      // flipped -> unflip, then put down after animation
      setIsFlipped(false);
      putDownAfterUnflipRef.current = true;
    },
    [id, isActive, isFlipped, onToggle]
  );

  return (
    <group ref={groupRef}>
      <group rotation={[0, 0, 0]}>
        {/* FRONT */}
        <mesh
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
          castShadow
          receiveShadow
        >
          <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
          <meshStandardMaterial
            map={texture}
            roughness={0.35}
            metalness={0.05}
            toneMapped={false}
          />
        </mesh>

        {/* BACK (also clickable so you can flip back / put down) */}
        <mesh
          position={[0, 0, -0.001]}
          rotation={[0, Math.PI, 0]}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
        >
          <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
          <meshStandardMaterial
            map={backTexture}
            roughness={0.35}
            metalness={0.05}
            toneMapped={false}
          />
        </mesh>

        {children}
      </group>
    </group>
  );
}
