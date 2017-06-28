import Publish from '../Publish';
import Secret from '../CMSSecret';
import Inbox from '../Inbox';
import Choose from '../Choose';
import Submissions from '../Submissions';
import PlaybackFlow from '../PlaybackFlow';

export default {
  '/publish': Publish,
  '/secret': Secret,
  '/submissions': Submissions,
  '/inbox/:recordingId?': Inbox,
  '/choose/:roomId': Choose,
  '/:roomId?/:id?': PlaybackFlow,
};