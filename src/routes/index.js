import router from '../router';
import playback from './playback';
import record from './record';
//import gif from './gif';
import notFound from './not-found';
import transition from '../transition';
import hud from '../hud';
import audio from '../audio';

let current;

// const components = { record, playback, gif };
const components = { record, playback };
const routes = {
  '/record/:loopIndex?/:hideHead?': record,
  '/:loopIndex?/:id?': playback,
  //'/gif/:loopIndex?/:id?': gif,
  '/*': notFound,
};

export const mount = async (id, req = { params: {} }, event) => {
  const route = routes[id] || components[id];
  if (!route || (event && event.parent())) return;
  if (current) {
    audio.reset();
    current.unmount();
    hud.clear();
    current = null;
  }

  hud.hideLoader();
  if (transition.isInside()) {
    await transition.fadeOut();
  }
  current = route(req);
  current.mount();
  hud.update(current.hud);
};

export const installRouter = () => {
  Object
    .keys(routes)
    .forEach((url) => {
      router.get(url, (req, event) => mount(url, req, event));
    });
};
