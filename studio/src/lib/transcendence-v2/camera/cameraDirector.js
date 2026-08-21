import * as THREE from 'three';

const DEG = THREE.MathUtils.DEG2RAD;
const LIMITS = Object.freeze({
  yawSpeed: 4.8 * DEG,
  pitchSpeed: 3.0 * DEG,
  rollSpeed: 0.65 * DEG,
  yawAcceleration: 5.5 * DEG,
  pitchAcceleration: 4.0 * DEG,
  rollAcceleration: 1.4 * DEG,
  fovSpeed: 1.65,
  verticalSpeed: 250,
  verticalAcceleration: 72,
});

export class CameraDirector {
  constructor(camera, prefersReducedMotion = false) {
    this.camera = camera;
    this.prefersReducedMotion = prefersReducedMotion;
    this.targetPosition = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();
    this.desiredQuaternion = new THREE.Quaternion();
    this.lookMatrix = new THREE.Matrix4();
    this.currentEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.desiredEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.angularVelocity = new THREE.Vector3();
    this.verticalVelocity = 0;
    this.metrics = {
      maxYawVelocity: 0,
      maxPitchVelocity: 0,
      maxRollVelocity: 0,
      maxAngularAcceleration: 0,
      maxFovVelocity: 0,
      maxVerticalAcceleration: 0,
    };
  }

  frameShot(shot, immediate = false) {
    this.camera.up.set(0, 1, 0);
    this.targetPosition.copy(shot.position);
    this.targetLookAt.copy(shot.target);
    if (!immediate) return;
    this.camera.position.copy(shot.position);
    this.currentLookAt.copy(shot.target);
    this.camera.fov = shot.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(shot.target);
    this.currentEuler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.angularVelocity.set(0, 0, 0);
    this.verticalVelocity = 0;
  }

  update(shot, delta) {
    const dt = THREE.MathUtils.clamp(delta, 0, 1 / 20);
    if (dt === 0) return;
    this.camera.up.set(0, 1, 0);
    this.targetPosition.copy(shot.position);
    this.targetLookAt.copy(shot.target);

    const positionResponse = 1 - Math.exp(-dt * 0.82);
    const lookResponse = 1 - Math.exp(-dt * 0.42);
    this.camera.position.x += (this.targetPosition.x - this.camera.position.x) * positionResponse;
    this.camera.position.z += (this.targetPosition.z - this.camera.position.z) * positionResponse;
    this.updateVerticalPosition(dt);
    this.currentLookAt.lerp(this.targetLookAt, lookResponse);

    this.lookMatrix.lookAt(this.camera.position, this.currentLookAt, this.camera.up);
    this.desiredQuaternion.setFromRotationMatrix(this.lookMatrix);
    this.desiredEuler.setFromQuaternion(this.desiredQuaternion, 'YXZ');
    this.desiredEuler.x = THREE.MathUtils.clamp(this.desiredEuler.x, -58 * DEG, 14 * DEG);
    this.desiredEuler.z = 0;
    this.updateOrientation(dt);
    this.updateLens(shot.fov, dt);
  }

  updateVerticalPosition(dt) {
    const error = this.targetPosition.y - this.camera.position.y;
    const desiredVelocity = THREE.MathUtils.clamp(error * 0.9, -LIMITS.verticalSpeed, LIMITS.verticalSpeed);
    const previousVelocity = this.verticalVelocity;
    this.verticalVelocity = moveToward(this.verticalVelocity, desiredVelocity, LIMITS.verticalAcceleration * dt);
    const acceleration = Math.abs(this.verticalVelocity - previousVelocity) / Math.max(dt, 0.0001);
    this.metrics.maxVerticalAcceleration = Math.max(this.metrics.maxVerticalAcceleration, acceleration);
    const step = this.verticalVelocity * dt;
    if (Math.abs(step) >= Math.abs(error) && Math.sign(step) === Math.sign(error)) {
      this.camera.position.y = this.targetPosition.y;
      this.verticalVelocity = 0;
    } else {
      this.camera.position.y += step;
    }
  }

  updateOrientation(dt) {
    const deltas = {
      pitch: shortestAngle(this.desiredEuler.x - this.currentEuler.x),
      yaw: shortestAngle(this.desiredEuler.y - this.currentEuler.y),
      roll: shortestAngle(-this.currentEuler.z),
    };
    const previous = this.angularVelocity.clone();
    this.angularVelocity.x = limitedAngularVelocity(this.angularVelocity.x, deltas.pitch, LIMITS.pitchSpeed, LIMITS.pitchAcceleration, dt);
    this.angularVelocity.y = limitedAngularVelocity(this.angularVelocity.y, deltas.yaw, LIMITS.yawSpeed, LIMITS.yawAcceleration, dt);
    this.angularVelocity.z = limitedAngularVelocity(this.angularVelocity.z, deltas.roll, LIMITS.rollSpeed, LIMITS.rollAcceleration, dt);

    const accelerationStep = this.angularVelocity.clone().sub(previous);
    const maximumAngularStep = 5.8 * DEG * dt;
    if (accelerationStep.length() > maximumAngularStep) {
      accelerationStep.setLength(maximumAngularStep);
      this.angularVelocity.copy(previous).add(accelerationStep);
    }

    this.currentEuler.x += this.angularVelocity.x * dt;
    this.currentEuler.y += this.angularVelocity.y * dt;
    this.currentEuler.z += this.angularVelocity.z * dt;
    this.currentEuler.x = THREE.MathUtils.clamp(this.currentEuler.x, -58 * DEG, 14 * DEG);
    this.camera.quaternion.setFromEuler(this.currentEuler);

    this.metrics.maxPitchVelocity = Math.max(this.metrics.maxPitchVelocity, Math.abs(this.angularVelocity.x));
    this.metrics.maxYawVelocity = Math.max(this.metrics.maxYawVelocity, Math.abs(this.angularVelocity.y));
    this.metrics.maxRollVelocity = Math.max(this.metrics.maxRollVelocity, Math.abs(this.angularVelocity.z));
    const angularAcceleration = this.angularVelocity.clone().sub(previous).length() / Math.max(dt, 0.0001);
    this.metrics.maxAngularAcceleration = Math.max(this.metrics.maxAngularAcceleration, angularAcceleration);
  }

  updateLens(desiredFov, dt) {
    const dampedDelta = (desiredFov - this.camera.fov) * (1 - Math.exp(-dt * 0.72));
    const change = THREE.MathUtils.clamp(dampedDelta, -LIMITS.fovSpeed * dt, LIMITS.fovSpeed * dt);
    this.camera.fov += change;
    this.metrics.maxFovVelocity = Math.max(this.metrics.maxFovVelocity, Math.abs(change) / Math.max(dt, 0.0001));
    this.camera.updateProjectionMatrix();
  }
}

function limitedAngularVelocity(current, angleError, maxSpeed, maxAcceleration, dt) {
  const desired = THREE.MathUtils.clamp(angleError * 0.72, -maxSpeed, maxSpeed);
  return moveToward(current, desired, maxAcceleration * dt);
}

function moveToward(current, target, maximumDelta) {
  if (Math.abs(target - current) <= maximumDelta) return target;
  return current + Math.sign(target - current) * maximumDelta;
}

function shortestAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;
}
