import * as THREE from '../lib/three';

import props from '../props';
import {
  tempVector,
  setIdentityMatrix,
  set180RotationMatrix,
} from '../utils/three';
import viewer from '../viewer';
import settings from '../settings';
import {
  getCostumeColor,
  getRoomColor,
  recordCostumeColor,
  recordRoomColor,
  highlightColor,
} from '../theme/colors';

import layout from './layout';
import dummyTextureUrl from '../public/dummy.png';
import InstancedItem from '../instanced-item';
import Frames from '../frames';

let items;

const roomOffset = new THREE.Vector3(0, settings.roomHeight * 0.5, 0);

const debugMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0, 0, 0),
  new THREE.MeshBasicMaterial({
    map: new THREE.TextureLoader().load(dummyTextureUrl),
  })
);
debugMesh.frustumCulled = false;

export default class Room {
  constructor({ url, recording, index, single }) {
    this._worldPosition = new THREE.Vector3();
    this.index = index;
    const frames = this.frames = new Frames(url, recording);
    this.firstFrame = frames.getFrame(0);
    this.frame = frames.getFrame();
    if (recording) {
      this.changeColor(recordRoomColor);
    }

    this.costumeColor = recording
      ? recordCostumeColor
      : getCostumeColor(index);
    this.position = layout.getPosition(
      index,
      new THREE.Vector3(),
      (!!recording || !!single)
    );

    const position = tempVector()
      .add(this.position)
      .add(roomOffset);
    position.y -= 1;
    const type = layout.getType(index);
    if (type === 'PLANE') return;
    items.room.add([position, null], getRoomColor(index));
    if (layout.hasWall(index)) {
      items.wall.add([position, null], getRoomColor(index));
    }
  }

  load(callback) {
    this.frames.load(callback);
  }

  get worldPosition() {
    return this._worldPosition
      .copy(this.position)
      .applyMatrix4(InstancedItem.group.matrix);
  }

  isHighlighted(performance) {
    return Room.highlight.roomIndex === this.index
      && Room.highlight.performanceIndex === performance;
  }

  changeColor(color) {
    items.room.changeColor(this.index, color);
    // items.wall.change(this.index, color);
  }

  getHeadPosition(index, applyMatrix = true) {
    return this.frame.getHeadPose(index, this.position, applyMatrix)[0];
  }

  getRHandPosition(index, applyMatrix = true) {
    return this.frame.getRHandPose(index, this.position, applyMatrix)[0];
  }

  getLHandPosition(index, applyMatrix = true) {
    return this.frame.getLHandPose(index, this.position, applyMatrix)[0];
  }

  transformToHead(object, layerIndex) {
    const [position, rotation] = this.frame.getHeadPose(layerIndex, this.position, false);
    object.position.copy(position);
    object.quaternion.copy(rotation);
  }

  gotoTime(seconds, maxLayers) {
    // In orthographic mode, scale up the meshes:
    const scale = InstancedItem.perspectiveMode ? 1 : 1.3;

    const { position, frame, costumeColor } = this;
    frame.gotoTime(seconds, maxLayers);
    const { hideHead } = this.frames;
    for (let i = 0; i < frame.count; i++) {
      const color = this.isHighlighted(i) ? highlightColor : costumeColor;
      if (!hideHead) {
        const pose = frame.getPose(i, 0, position);
        items.head.add(pose, color, scale);
      }
      items.hand.add(frame.getPose(i, 1, position), color, scale);
      items.hand.add(frame.getPose(i, 2, position), color, scale);
    }
  }

  destroy() {
    for (const i in items) {
      items[i].empty();
    }
    if (this.frames) this.frames.cancel();
  }
}

Room.clear = () => {
  items.hand.empty();
  items.head.empty();
};

Room.reset = () => {
  InstancedItem.reset();
  Room.setHighlight();
  setIdentityMatrix(InstancedItem.group);

  if (!items) {
    items = {
      wall: new InstancedItem(
        layout.roomCount,
        props.perspectiveWall,
        props.orthographicWall
      ),
      room: new InstancedItem(
        layout.roomCount,
        props.perspectiveRoom,
        props.orthographicRoom
      ),
      head: new InstancedItem(
        layout.roomCount * 10,
        props.head,
      ),
      hand: new InstancedItem(
        layout.roomCount * 10 * 2,
        props.hand,
      ),
    };
  }

  // Move an extra invisible object3d with a texture to the end of scene's children
  // array in order to solve a texture glitch as described in:
  // https://github.com/puckey/you-move-me/issues/129
  viewer.scene.add(debugMesh);
};

Room.rotate180 = () => {
  set180RotationMatrix(InstancedItem.group);
};

Room.highlight = {};

Room.setHighlight = ([room, performance] = []) => {
  Room.highlight.roomIndex = room;
  Room.highlight.performanceIndex = performance;
};
