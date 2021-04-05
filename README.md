# JDAM

_It's the bomb_

## MVP

* Use WebRTC to allow multiple users to connect video and audio to a live
  session
* Users send output from their DAW over any virtual input to be used for
  recording clips on-the-fly
* Allow users to upload their own audio clips in exactly one format 
* Force users to define start and end points in their audio clips before
  uploading, so that the looping system knows where to place them.
  - This allows for effects like reverb and delay to go "past" the end of the
    loop and be blended in with the next playback of that loop
* Tree-based organization
  - each "node" contains a new audio file and any audio files from its parent
    nodes
  - each node can be given children to iterate over several ideas
  - for the sake of bandwidth and processing constraints on the web, limit each
    node to 3 children and 4 layers
  - if a node is removed and it has children, all of its children are removed
* File browser to allow for downloading individual tracks
* Render functionality to allow for converting a node's contents into a single
  audio file for saving

### Notes about server arch

* The intent is to use docker to create sessions with localized storage and
  processing, and then use the server as a reverse proxy to route incoming
  traffic directly to the docker containers. Once the session ends, the docker
  container is terminated and all the temporal files are automatically cleaned
  up.
* This probably needs a custom docker network that can support Class A, because
  there is no way that there are enough ports to scale up
* Persistent storage
  - MongoDB
  - Store information about users and their sessions
  - Potentially store final renders (but only final renders)
