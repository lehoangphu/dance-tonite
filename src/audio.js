import emitter from 'mitt';
import audioPool from './utils/audio-pool';
import feature from './utils/feature';
import { sleep } from './utils/async';

const AudioContext = window.AudioContext || window.webkitAudioContext;

let context;
let source;
let gainNode;
let loopCount;
let duration = 0;
let lastTime = 0;
let startTime;
let audioElement;
let request;
let onCanPlayThrough;

const FADE_OUT_SECONDS = 2;
const ALMOST_ZERO = 1e-4;

let scheduledTime;

const audio = Object.assign(emitter(), {
  tick() {
    if (!audioElement && !context) return;
    const currentTime = this.currentTime = audioElement
      ? audioElement.currentTime
      : context.currentTime - startTime;
    const time = this.time = duration > 0
      ? currentTime % duration
      : currentTime;

    const { loopDuration } = this;
    // The position within the track as a multiple of loopDuration:
    this.progress = time > 0
      ? time / loopDuration
      : 0;

    // The position within the individual loop as a value between 0 - 1:
    this.loopProgress = (time % loopDuration) / loopDuration;

    // True when the audio looped, false otherwise:
    this.looped = time < lastTime;

    if (this.looped) {
      // The index of the loop, used when the audio has more than one loops:
      this.loopIndex = Math.floor(this.progress * loopCount);
      this.loopCount++;
    }

    this.totalProgress = this.loopCount * loopCount + this.progress;
    lastTime = time;
  },

  load(param) {
    return new Promise(async (resolve, reject) => {
      if (context) context.close();
      context = new AudioContext();
      gainNode = context.createGain();
      // Reset time, set loop count
      lastTime = 0;
      loopCount = param.loops === undefined
        ? 1
        : param.loops;
      this.loopCount = 0;
      const canPlay = () => {
        this.duration = duration;
        this.loopDuration = duration / loopCount;
        startTime = context.currentTime;
        context.suspend();
        resolve(param.src);
      };

      if (param.loopOffset) {
        this.loopOffset = param.loopOffset;
      }

      if (param.progressive) {
        audioElement = feature.isMobile
          ? audioPool.get()
          : new Audio();
        audioElement.addEventListener('ended', () => audio.emit('ended'));
        audioElement.autoplay = true;
        audioElement.src = param.src;
        audioElement.loop = param.loop === undefined ? true : param.loop;
        onCanPlayThrough = () => {
          duration = audioElement.duration;
          canPlay();
          audioElement.removeEventListener('canplaythrough', onCanPlayThrough);
        };
        audioElement.addEventListener('canplaythrough', onCanPlayThrough);
        source = context.createMediaElementSource(audioElement);
      } else {
        source = context.createBufferSource();
        request = new XMLHttpRequest();
        request.open('GET', param.src, true);
        request.responseType = 'arraybuffer';
        request.onload = () => {
          context.decodeAudioData(
            request.response,
            (response) => {
              // Load the file into the buffer
              source.buffer = response;
              duration = source.buffer.duration;
              source.loop = param.loop === undefined ? true : param.loop;
              source.start(0);
              canPlay();
            },
            reject
          );
        };
        request.send();
      }
      source.connect(gainNode);
      gainNode.connect(context.destination);
    });
  },

  play() {
    if (context) context.resume();
    if (feature.isMobile) {
      audioElement.play();
    }
  },

  pause() {
    if (context) context.suspend();
  },

  gotoTime(time) {
    audioElement.currentTime = time;
  },

  reset() {
    audio.fadeOut();
    // Cancel loading of audioElement:
    if (audioElement) {
      audioElement.removeEventListener('canplaythrough', onCanPlayThrough);
      if (feature.isMobile) {
        audioPool.release(audioElement);
      }
      audioElement = null;
      onCanPlayThrough = null;
    }
    if (request) {
      request.abort();
      request.onload = null;
      request = null;
    }
  },

  rewind() {
    if (audioElement) {
      audioElement.currentTime = 0;
      gainNode.gain.value = 1;
    }
  },

  mute() {
    gainNode.gain.value = 0.001;
  },

  async fadeOut(fadeDuration = FADE_OUT_SECONDS) {
    if (!context) return;
    if (scheduledTime) {
      gainNode.gain.cancelScheduledValues(scheduledTime);
    }
    scheduledTime = context.currentTime;
    gainNode.gain.exponentialRampToValueAtTime(
      ALMOST_ZERO,
      scheduledTime + fadeDuration
    );
    return sleep(fadeDuration * 1000);
  },

  async fadeIn(fadeDuration = FADE_OUT_SECONDS) {
    if (!context) return;
    if (scheduledTime) {
      gainNode.gain.cancelScheduledValues(scheduledTime);
    }
    scheduledTime = context.currentTime;
    gainNode.gain.exponentialRampToValueAtTime(
      1,
      scheduledTime + fadeDuration
    );
    return sleep(fadeDuration * 1000);
  },

  time: 0,
  loopIndex: 0,
});

export default audio;
