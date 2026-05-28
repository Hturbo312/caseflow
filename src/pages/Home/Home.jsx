import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useMobileDetect } from '@hooks/useMobileDetect';
import { Sliders, EyeOff, ExternalLink, Mail, Phone, User } from 'lucide-react';
import './Home.css';

// ── 3D 图谱集群预设 ──
const CLUSTER_PRESETS = [
  { id: 1, relX: 0.15, relY: 0.70, relZ: 0.2, color: '#3dc9b0', size: 28, name: '数据分析' },
  { id: 2, relX: 0.288, relY: 0.440, relZ: -0.1, color: '#d186c3', size: 38, name: 'CaseFlow' },
  { id: 3, relX: 0.368, relY: 0.828, relZ: 0.4, color: '#9076bc', size: 14, name: 'Python' },
  { id: 4, relX: 0.439, relY: 0.239, relZ: -0.3, color: '#a2a99d', size: 18, name: 'GIS' },
  { id: 5, relX: 0.546, relY: 0.603, relZ: 0.0, color: '#e0f3f8', size: 45, name: 'Hturbo' },
  { id: 6, relX: 0.576, relY: 0.354, relZ: 0.25, color: '#8874a3', size: 18, name: 'AI / LLM' },
  { id: 7, relX: 0.651, relY: 0.114, relZ: -0.2, color: '#d48d94', size: 28, name: '更新旧城' },
  { id: 8, relX: 0.735, relY: 0.489, relZ: -0.15, color: '#4abfa1', size: 40, name: '知识图谱可视化' },
  { id: 9, relX: 0.754, relY: 0.776, relZ: 0.3, color: '#b9beae', size: 16, name: 'React' },
  { id: 10, relX: 0.875, relY: 0.246, relZ: 0.1, color: '#978db9', size: 20, name: 'TypeScript' },
  { id: 11, relX: 0.935, relY: 0.631, relZ: -0.3, color: '#c4cb87', size: 15, name: 'ABM 模拟' },
  { id: 12, relX: 0.884, relY: 0.862, relZ: 0.15, color: '#7bb0b8', size: 12, name: '博客 & 写作' }
];

const CLUSTER_CONNECTIONS = [
  { from: 1, to: 3, strength: 0.12 }, { from: 1, to: 4, strength: 0.08 },
  { from: 2, to: 5, strength: 0.15 }, { from: 2, to: 6, strength: 0.10 },
  { from: 2, to: 8, strength: 0.12 }, { from: 3, to: 6, strength: 0.08 },
  { from: 4, to: 1, strength: 0.06 }, { from: 5, to: 9, strength: 0.10 },
  { from: 5, to: 10, strength: 0.08 }, { from: 6, to: 11, strength: 0.07 },
  { from: 7, to: 11, strength: 0.10 }, { from: 7, to: 4, strength: 0.06 },
  { from: 8, to: 2, strength: 0.08 }, { from: 9, to: 10, strength: 0.10 },
  { from: 10, to: 2, strength: 0.06 }, { from: 11, to: 7, strength: 0.08 },
  { from: 12, to: 6, strength: 0.05 }, { from: 12, to: 2, strength: 0.07 }
];

const physics = { gravity: 0.05, repulsion: 35, density: 0.70, friction: 0.90, isMoving: true };

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1], 16) / 255, g: parseInt(r[2], 16) / 255, b: parseInt(r[3], 16) / 255 } : { r: 1, g: 1, b: 1 };
}

const textureCache = {};
function createGlowTexture(colorHex) {
  if (textureCache[colorHex]) return textureCache[colorHex];
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.2, colorHex);
  gradient.addColorStop(0.5, colorHex + '33');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  textureCache[colorHex] = texture;
  return texture;
}

function get3DPos(relX, relY, relZ) {
  return new THREE.Vector3((relX - 0.5) * 150, -(relY - 0.5) * 90, relZ * 60);
}

class Cluster3D {
  constructor(preset) {
    this.id = preset.id;
    this.pos = get3DPos(preset.relX, preset.relY, preset.relZ);
    this.targetPos = this.pos.clone();
    this.color = preset.color;
    this.baseSize = preset.size;
    this.name = preset.name;
    this.isDragging = false;
    this.scaleX = 0.6 + Math.random() * 1.3;
    this.scaleY = 0.6 + Math.random() * 1.3;
    this.scaleZ = 0.6 + Math.random() * 1.3;
    this.rotX = Math.random() * Math.PI * 2;
    this.rotY = Math.random() * Math.PI * 2;
    this.rotZ = Math.random() * Math.PI * 2;
    this.subCenters = [];
    const subCount = 1 + Math.floor(Math.random() * 3);
    for (let s = 0; s < subCount; s++) {
      this.subCenters.push(new THREE.Vector3(
        (Math.random() - 0.5) * preset.size * 0.4,
        (Math.random() - 0.5) * preset.size * 0.4,
        (Math.random() - 0.5) * preset.size * 0.4
      ));
    }
    const geom = new THREE.SphereGeometry(preset.size * 0.16 + 2.5, 8, 8);
    this.clickMesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ visible: false }));
    this.clickMesh.position.copy(this.pos);
    this.clickMesh.userData = { clusterId: this.id };
  }
  update(group) {
    if (this.isDragging) this.pos.lerp(this.targetPos, 0.25);
    this.clickMesh.position.copy(this.pos);
  }
}

class Node3D {
  constructor(cluster, index) {
    this.cluster = cluster;
    this.id = `${cluster.id}_${index}`;
    const subCenter = cluster.subCenters[index % cluster.subCenters.length];
    const u = Math.random(), v = Math.random();
    const theta = u * 2.0 * Math.PI, phi = Math.acos(2.0 * v - 1.0);
    const isDust = Math.random() > 0.85;
    const spreadScale = isDust ? 1.7 : 0.7;
    const r = Math.cbrt(Math.random()) * (cluster.baseSize * 0.3 * spreadScale + 2);
    let localPos = new THREE.Vector3(
      subCenter.x + r * Math.sin(phi) * Math.cos(theta),
      subCenter.y + r * Math.sin(phi) * Math.sin(theta),
      subCenter.z + r * Math.cos(phi)
    );
    localPos.x *= cluster.scaleX; localPos.y *= cluster.scaleY; localPos.z *= cluster.scaleZ;
    localPos.applyEuler(new THREE.Euler(cluster.rotX, cluster.rotY, cluster.rotZ));
    this.localOffset = localPos.clone();
    this.pos = new THREE.Vector3().addVectors(cluster.pos, this.localOffset);
    this.vel = new THREE.Vector3((Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3);
    this.colorHex = cluster.color;
  }
  updatePhysics() {
    if (!physics.isMoving) return;
    const target = new THREE.Vector3().addVectors(this.cluster.pos, this.localOffset);
    const force = new THREE.Vector3().subVectors(target, this.pos);
    this.vel.addScaledVector(force, physics.gravity * 0.05);
    this.vel.multiplyScalar(physics.friction);
    this.pos.add(this.vel);
    const limit = 130;
    if (Math.abs(this.pos.x) > limit) { this.pos.x = Math.sign(this.pos.x) * limit; this.vel.x *= -0.5; }
    if (Math.abs(this.pos.y) > limit) { this.pos.y = Math.sign(this.pos.y) * limit; this.vel.y *= -0.5; }
    if (Math.abs(this.pos.z) > limit) { this.pos.z = Math.sign(this.pos.z) * limit; this.vel.z *= -0.5; }
  }
}

function Home() {
  const isMobile = useMobileDetect();
  const canvasRef = useRef(null);
  const labelsRef = useRef(null);
  const [hintText, setHintText] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [motionState, setMotionState] = useState(true);
  const [gravityVal, setGravityVal] = useState(0.12);
  const [repulsionVal, setRepulsionVal] = useState(20);
  const [totalEdges, setTotalEdges] = useState(0);
  const [totalNodes, setTotalNodes] = useState(0);
  const [physicsVisible, setPhysicsVisible] = useState(false);
  const [activeCluster, setActiveCluster] = useState(null);
  const [showMessage, setShowMessage] = useState(false);
  const [msgName, setMsgName] = useState('');
  const [msgEmail, setMsgEmail] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgSent, setMsgSent] = useState(false);

  const sceneRef = useRef({
    clusters: [], nodes: [], labelElements: [],
    pointsObj: null, intraLinesObj: null, interLinesObj: null, networkGroup: null,
    isRotating: false, prevMouseX: 0, prevMouseY: 0,
    targetRotationY: -0.15, targetRotationX: 0.08, zoomDistance: 145,
    draggedCluster: null, animFrameId: null, labelClickCallbacks: {}
  });

  // 集群点击回调
  const getClusterAction = (name) => {
    const preset = CLUSTER_PRESETS.find(p => p.name === name);
    const color = preset?.color || '#22d3ee';
    switch(name) {
      case 'Hturbo':
        return { type: 'info', title: 'Hturbo', color, lines: ['wjl20010702@163.com', '18811722967'] };
      case 'CaseFlow':
        return { type: 'link', title: 'CaseFlow', color, url: '/caseflow', label: 'View Project' };
      default:
        return { type: 'label', title: name, color };
    }
  };

  const handleMsgSubmit = () => {
    if (!msgName.trim() || !msgBody.trim()) return;
    const subject = encodeURIComponent(`[Hturbo主页留言] 来自 ${msgName}`);
    const body = encodeURIComponent(`留言人: ${msgName}\n邮箱: ${msgEmail || '未填写'}\n\n${msgBody}`);
    window.location.href = `mailto:wjl20010702@163.com?subject=${subject}&body=${body}`;
    setMsgSent(true);
    setTimeout(() => { setMsgSent(false); setShowMessage(false); setMsgName(''); setMsgEmail(''); setMsgBody(''); }, 3000);
  };

  const handleClusterClick = (name) => {
    const action = getClusterAction(name);
    setActiveCluster(activeCluster === name ? null : name);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = sceneRef.current;
    let width = window.innerWidth, height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030508, 0.0035);
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, s.zoomDistance);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const networkGroup = new THREE.Group();
    scene.add(networkGroup);
    s.networkGroup = networkGroup;

    function buildNetwork() {
      if (labelsRef.current) labelsRef.current.innerHTML = '';
      s.labelElements = [];
      s.labelClickCallbacks = {};
      if (s.pointsObj) networkGroup.remove(s.pointsObj);
      if (s.intraLinesObj) networkGroup.remove(s.intraLinesObj);
      if (s.interLinesObj) networkGroup.remove(s.interLinesObj);
      s.clusters.forEach(c => networkGroup.remove(c.clickMesh));
      s.clusters = []; s.nodes = [];

      CLUSTER_PRESETS.forEach(preset => {
        const cluster = new Cluster3D(preset);
        networkGroup.add(cluster.clickMesh);
        s.clusters.push(cluster);
        const nodeCount = Math.floor(cluster.baseSize * 1.5);
        for (let i = 0; i < nodeCount; i++) s.nodes.push(new Node3D(cluster, i));

        if (labelsRef.current) {
          const btn = document.createElement('button');
          btn.className = 'cluster-label-btn';
          btn.innerText = preset.name;
          btn.style.borderColor = preset.color + '88';
          btn.style.background = preset.color + '18';
          btn.onclick = () => handleClusterClick(preset.name);
          labelsRef.current.appendChild(btn);
          s.labelElements.push({ element: btn, cluster });
          s.labelClickCallbacks[preset.name] = btn;
        }
      });

      setTotalNodes(s.nodes.length);

      const pointsGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(s.nodes.length * 3);
      const colors = new Float32Array(s.nodes.length * 3);
      s.nodes.forEach((node, i) => {
        positions[i*3] = node.pos.x; positions[i*3+1] = node.pos.y; positions[i*3+2] = node.pos.z;
        const rgb = hexToRgb(node.colorHex);
        colors[i*3] = rgb.r; colors[i*3+1] = rgb.g; colors[i*3+2] = rgb.b;
      });
      pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      pointsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const pointsMaterial = new THREE.PointsMaterial({
        size: 3.2, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
      });
      pointsMaterial.map = createGlowTexture('#ffffff');
      s.pointsObj = new THREE.Points(pointsGeometry, pointsMaterial);
      networkGroup.add(s.pointsObj);

      s.intraLinesObj = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      networkGroup.add(s.intraLinesObj);

      s.interLinesObj = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      networkGroup.add(s.interLinesObj);
    }

    buildNetwork();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const dragIntersection = new THREE.Vector3();

    const onMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(networkGroup.children.filter(c => c.userData && c.userData.clusterId));
      if (intersects.length > 0) {
        const hitId = intersects[0].object.userData.clusterId;
        const cluster = s.clusters.find(c => c.id === hitId);
        if (cluster) {
          cluster.isDragging = true;
          s.draggedCluster = cluster;
          setHintText(`正在激活实体链：${cluster.name}`);
          setShowHint(true);
          setTimeout(() => setShowHint(false), 3000);
          const normal = new THREE.Vector3();
          camera.getWorldDirection(normal); normal.negate();
          dragPlane.setFromNormalAndCoplanarPoint(normal, intersects[0].point);
        }
      } else {
        s.isRotating = true; s.prevMouseX = e.clientX; s.prevMouseY = e.clientY;
      }
    };
    const onMouseMove = (e) => {
      if (s.draggedCluster) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
          s.draggedCluster.targetPos.copy(networkGroup.worldToLocal(dragIntersection.clone()));
        }
      } else if (s.isRotating) {
        s.targetRotationY += (e.clientX - s.prevMouseX) * 0.005;
        s.targetRotationX += (e.clientY - s.prevMouseY) * 0.005;
        s.targetRotationX = Math.max(-Math.PI/3, Math.min(Math.PI/3, s.targetRotationX));
        s.prevMouseX = e.clientX; s.prevMouseY = e.clientY;
      }
    };
    const onMouseUp = () => { s.draggedCluster && (s.draggedCluster.isDragging = false); s.draggedCluster = null; s.isRotating = false; };
    const onWheel = (e) => { s.zoomDistance += e.deltaY * 0.12; s.zoomDistance = Math.max(40, Math.min(300, s.zoomDistance)); e.preventDefault(); };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0], rect = canvas.getBoundingClientRect();
        mouse.x = ((touch.clientX - rect.left) / width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(networkGroup.children.filter(c => c.userData && c.userData.clusterId));
        if (intersects.length > 0) {
          const cluster = s.clusters.find(c => c.id === intersects[0].object.userData.clusterId);
          if (cluster) {
            cluster.isDragging = true; s.draggedCluster = cluster;
            const normal = new THREE.Vector3(); camera.getWorldDirection(normal); normal.negate();
            dragPlane.setFromNormalAndCoplanarPoint(normal, intersects[0].point);
          }
        } else { s.isRotating = true; s.prevMouseX = touch.clientX; s.prevMouseY = touch.clientY; }
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0], rect = canvas.getBoundingClientRect();
        mouse.x = ((touch.clientX - rect.left) / width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / height) * 2 + 1;
        if (s.draggedCluster) {
          raycaster.setFromCamera(mouse, camera);
          if (raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
            s.draggedCluster.targetPos.copy(networkGroup.worldToLocal(dragIntersection.clone()));
          }
        } else if (s.isRotating) {
          s.targetRotationY += (touch.clientX - s.prevMouseX) * 0.008;
          s.targetRotationX += (touch.clientY - s.prevMouseY) * 0.008;
          s.targetRotationX = Math.max(-Math.PI/3, Math.min(Math.PI/3, s.targetRotationX));
          s.prevMouseX = touch.clientX; s.prevMouseY = touch.clientY;
        }
      }
    }, { passive: true });
    canvas.addEventListener('touchend', () => { s.draggedCluster && (s.draggedCluster.isDragging = false); s.draggedCluster = null; s.isRotating = false; });

    const tempV = new THREE.Vector3();
    function animate() {
      s.animFrameId = requestAnimationFrame(animate);
      networkGroup.rotation.y += (s.targetRotationY - networkGroup.rotation.y) * 0.08;
      networkGroup.rotation.x += (s.targetRotationX - networkGroup.rotation.x) * 0.08;
      camera.position.z += (s.zoomDistance - camera.position.z) * 0.1;

      s.clusters.forEach(c => c.update(networkGroup));
      if (physics.isMoving) {
        for (let i = 0; i < s.nodes.length; i++) {
          const a = s.nodes[i];
          for (let j = i + 1; j < s.nodes.length; j++) {
            const b = s.nodes[j];
            if (a.cluster.id === b.cluster.id) {
              const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y, dz = b.pos.z - a.pos.z;
              const distSqr = dx*dx + dy*dy + dz*dz;
              const minDist = physics.repulsion;
              if (distSqr < minDist*minDist && distSqr > 0.01) {
                const dist = Math.sqrt(distSqr), force = (minDist - dist) / dist * 0.015;
                a.vel.x -= dx*force; a.vel.y -= dy*force; a.vel.z -= dz*force;
                b.vel.x += dx*force; b.vel.y += dy*force; b.vel.z += dz*force;
              }
            }
          }
        }
      }

      if (s.pointsObj && s.pointsObj.geometry) {
        const pa = s.pointsObj.geometry.attributes.position;
        s.nodes.forEach((n, i) => { n.updatePhysics(); pa.setXYZ(i, n.pos.x, n.pos.y, n.pos.z); });
        pa.needsUpdate = true;
      }

      const intraPos = [], intraCol = [];
      let edgeCount = 0;
      for (let i = 0; i < s.nodes.length; i++) {
        const a = s.nodes[i];
        for (let j = i + 1; j < s.nodes.length; j++) {
          const b = s.nodes[j];
          if (a.cluster.id === b.cluster.id) {
            const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y, dz = b.pos.z - a.pos.z;
            const distSqr = dx*dx + dy*dy + dz*dz;
            const threshold = a.cluster.baseSize * 1.5;
            if (distSqr < threshold * threshold) {
              const ratio = 1 - Math.sqrt(distSqr) / threshold;
              if (ratio > (1 - physics.density)) {
                intraPos.push(a.pos.x, a.pos.y, a.pos.z, b.pos.x, b.pos.y, b.pos.z);
                const rgb = hexToRgb(a.colorHex);
                const la = ratio * 0.15;
                intraCol.push(rgb.r*la, rgb.g*la, rgb.b*la, rgb.r*la, rgb.g*la, rgb.b*la);
                edgeCount++;
              }
            }
          }
        }
      }
      if (s.intraLinesObj && s.intraLinesObj.geometry) {
        s.intraLinesObj.geometry.setAttribute('position', new THREE.Float32BufferAttribute(intraPos, 3));
        s.intraLinesObj.geometry.setAttribute('color', new THREE.Float32BufferAttribute(intraCol, 3));
        s.intraLinesObj.geometry.computeBoundingSphere();
      }

      const interPos = [], interCol = [];
      CLUSTER_CONNECTIONS.forEach(conn => {
        const from = s.clusters.find(c => c.id === conn.from);
        const to = s.clusters.find(c => c.id === conn.to);
        if (!from || !to) return;
        const nodesFrom = s.nodes.filter(n => n.cluster.id === conn.from);
        const nodesTo = s.nodes.filter(n => n.cluster.id === conn.to);
        const density = Math.floor(6 + conn.strength * 120);
        for (let k = 0; k < density; k++) {
          const nF = nodesFrom[k % nodesFrom.length];
          const nT = nodesTo[(k*3) % nodesTo.length];
          if (nF && nT) {
            interPos.push(nF.pos.x, nF.pos.y, nF.pos.z, nT.pos.x, nT.pos.y, nT.pos.z);
            const dx = nT.pos.x-nF.pos.x, dy = nT.pos.y-nF.pos.y, dz = nT.pos.z-nF.pos.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            let alpha = 0.08;
            if (isFinite(dist) && dist > 0.1) alpha = Math.min(0.5, Math.max(0.005, (180/dist)*0.04));
            const rF = hexToRgb(nF.colorHex), rT = hexToRgb(nT.colorHex);
            interCol.push(rF.r*alpha, rF.g*alpha, rF.b*alpha, rT.r*alpha, rT.g*alpha, rT.b*alpha);
            edgeCount++;
          }
        }
      });
      if (s.interLinesObj && s.interLinesObj.geometry) {
        s.interLinesObj.geometry.setAttribute('position', new THREE.Float32BufferAttribute(interPos, 3));
        s.interLinesObj.geometry.setAttribute('color', new THREE.Float32BufferAttribute(interCol, 3));
        s.interLinesObj.geometry.computeBoundingSphere();
      }
      setTotalEdges(edgeCount);

      s.labelElements.forEach(({ element, cluster }) => {
        if (!element) return;
        tempV.copy(cluster.pos);
        tempV.applyMatrix4(networkGroup.matrixWorld);
        const distToCam = camera.position.distanceTo(tempV);
        tempV.project(camera);
        if (tempV.z > 1) { element.style.display = 'none'; return; }
        element.style.display = 'block';
        element.style.left = `${(tempV.x*0.5+0.5)*width+12}px`;
        element.style.top = `${(tempV.y*-0.5+0.5)*height}px`;
        let opacity = 1 - (distToCam - 60) / (220 - 60);
        opacity = Math.max(0.15, Math.min(0.95, opacity));
        element.style.opacity = opacity;
        element.style.transform = `translate(0, -50%) scale(${Math.max(0.8, Math.min(1.1, 100/distToCam))})`;
      });

      renderer.render(scene, camera);
    }
    animate();

    const onResize = () => {
      width = window.innerWidth; height = window.innerHeight;
      camera.aspect = width / height; camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(s.animFrameId);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { physics.gravity = gravityVal; }, [gravityVal]);
  useEffect(() => { physics.repulsion = repulsionVal; }, [repulsionVal]);
  useEffect(() => { physics.isMoving = motionState; }, [motionState]);

  const action = activeCluster ? getClusterAction(activeCluster) : null;

  if (isMobile) {
    return (
      <div className="home-sci-fi mobile-fallback">
        <canvas ref={canvasRef} />
        <div className="mobile-content">
          <h1 className="mobile-title">Hturbo</h1>
          <p className="mobile-subtitle">数据分析师 & 城市规划师</p>
          <p className="mobile-bio">用多维知识网图理解城市复杂系统，用智能体编织未来治理方案。</p>
          <a href="/caseflow" className="mobile-link">进入 CaseFlow →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="home-sci-fi">
      <canvas ref={canvasRef} />
      <div ref={labelsRef} className="labels-container" />
      <div className="dot-grid" />

      <div className={`interaction-hint ${showHint ? 'visible' : ''}`}>
        <span className="hint-dot" />
        <span>{hintText}</span>
      </div>

      {/* 集群详情弹窗 */}
      {action && (
        <div className="cluster-popup">
          <div className="popup-header">
            <div className="popup-icon" style={{ background: (action?.color || '#22d3ee') + '33' }}>
              {action.type === 'info' && <User size={16} />}
              {action.type === 'link' && <ExternalLink size={16} />}
            </div>
            <h3>{action.title}</h3>
            <button className="popup-close" onClick={() => setActiveCluster(null)}>✕</button>
          </div>
          {action.type === 'info' && (
            <div className="popup-body">
              {action.lines.map((line, i) => (
                <div key={i} className="popup-line">
                  {line.includes('@') ? <Mail size={14} /> : line.match(/\d{11}/) ? <Phone size={14} /> : null}
                  <span>{line}</span>
                </div>
              ))}
            </div>
          )}
          {action.type === 'link' && (
            <div className="popup-body">
              <a href={action.url} className="popup-action-btn">
                <ExternalLink size={14} /> {action.label}
              </a>
            </div>
          )}
        </div>
      )}

      {/* 留言按钮 */}
      <button className="msg-btn" onClick={() => setShowMessage(true)} title="给我留言">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>

      {/* 留言弹窗 */}
      {showMessage && (
        <div className="msg-popup">
          <div className="popup-header">
            <div className="popup-icon" style={{ background: '#22d3ee33' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3>发送留言</h3>
            <button className="popup-close" onClick={() => { setShowMessage(false); setMsgSent(false); }}>✕</button>
          </div>
          {msgSent ? (
            <div className="popup-body" style={{ textAlign: 'center', padding: '24px 20px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
              <p style={{ color: '#e2e8f0', fontSize: '13px', margin: 0 }}>邮件客户端已打开，发送即可！</p>
            </div>
          ) : (
            <div className="popup-body">
              <input className="msg-input" placeholder="你的称呼" value={msgName} onChange={e => setMsgName(e.target.value)} />
              <input className="msg-input" placeholder="你的邮箱（可选）" value={msgEmail} onChange={e => setMsgEmail(e.target.value)} />
              <textarea className="msg-textarea" rows={4} placeholder="想说的话..." value={msgBody} onChange={e => setMsgBody(e.target.value)} />
              <button className="msg-submit-btn" onClick={handleMsgSubmit}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                发送留言
              </button>
              <p className="msg-hint">将通过邮件发送到 wjl20010702@163.com</p>
            </div>
          )}
        </div>
      )}

      {/* 物理控制面板 */}
      <div className={`physics-panel ${physicsVisible ? '' : 'hidden-panel'}`}>
        <div className="physics-header">
          <span><Sliders size={14} className="text-cyan-400" /> 物理控制</span>
          <div className="physics-header-actions">
            <button className="panel-hide-btn" onClick={() => setPhysicsVisible(false)} title="收起">
              <EyeOff size={14} />
            </button>
          </div>
        </div>
        <div className="physics-control">
          <div className="control-label"><span>引力</span><span className="mono">{gravityVal.toFixed(2)}</span></div>
          <input type="range" min="0.01" max="0.15" step="0.01" value={gravityVal} onChange={e => setGravityVal(parseFloat(e.target.value))} />
        </div>
        <div className="physics-control">
          <div className="control-label"><span>斥力</span><span className="mono">{repulsionVal}</span></div>
          <input type="range" min="10" max="80" step="5" value={repulsionVal} onChange={e => setRepulsionVal(parseInt(e.target.value))} />
        </div>
        <button className="toggle-btn" onClick={() => setMotionState(!motionState)}>
          {motionState ? '冻结' : '恢复'}
        </button>
      </div>

      <button className={`physics-restore-btn ${!physicsVisible ? 'visible' : ''}`} onClick={() => setPhysicsVisible(true)} title="展开">
        <Sliders size={16} />
      </button>
    </div>
  );
}

export default Home;
