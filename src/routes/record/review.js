import * as THREE from '../../lib/three';
import audio from '../../audio';
import Playlist from '../../playlist';
import viewer from '../../viewer';
import settings from '../../settings';
import recording from '../../recording';
import storage from '../../storage';
import controllers from '../../controllers';
import transition from '../../transition';
import Room from '../../room';
import { tempVector } from '../../utils/three';
import { sleep } from '../../utils/async';

const { roomDepth, roomOffset } = settings;
const MATRIX = new THREE.Matrix4();
const POSITION = new THREE.Vector3();
const ROTATION = new THREE.Quaternion();
const SCALE = new THREE.Vector3();

const moveCamera = (progress) => {
  const zPos = roomOffset + ((progress - 1.5) * roomDepth);
  const fixedPosition = tempVector(0, settings.holeHeight, zPos);

  // Move controllers relative to fixed camera:
  viewer.controllers.forEach(controller => {
    controller.matrix.decompose(POSITION, ROTATION, SCALE);
    const { x, y, z } = POSITION.add(fixedPosition).sub(viewer.camera.position);
    controller.matrix.copyPosition(MATRIX.makeTranslation(x, y, z));
  });

  viewer.camera.position.copy(fixedPosition);
};

export default async (goto) => {
  const playlist = new Playlist({ recording });
  const tick = () => {
    audio.tick();
    playlist.tick();
    moveCamera(audio.totalProgress);
  };

  const performSubmit = async () => {
    controllers.update();
    const persisting = storage.persist(recording.serialize());
    audio.fadeOut();
    await transition.fadeOut();
    viewer.events.off('tick', tick);
    const [uri] = await Promise.all([
      persisting,
      transition.enter({
        text: 'Please take off your headset',
      }),
      sleep(5000),
    ]);
    await transition.fadeOut();
    goto(`/${uri.replace('.json', '')}`);
    transition.exit({ immediate: true });
  };

  const performRedo = async () => {
    audio.fadeOut();
    await transition.fadeOut();
    viewer.events.off('tick', tick);
    await transition.enter({
      text: 'Okay, here we go again',
      duration: 5000,
    });
    goto('record');
  };

  await Promise.all(
    [
      audio.load({
        src: `/public/sound/room-${recording.room || 1}.ogg`,
        loops: 2,
      }),
      sleep(5000),
    ]
  );
  await transition.fadeOut();
  audio.play();
  viewer.events.on('tick', tick);
  controllers.showButton();
  controllers.update({
    left: {
      text: 'press to redo',
      onPress: performRedo,
      removeOnPress: true,
    },
    right: {
      text: 'press to submit',
      onPress: performSubmit,
      removeOnPress: true,
    },
  });
  transition.exit();

  return () => {
    Room.reset();
    audio.fadeOut();
    playlist.destroy();
  };
};
