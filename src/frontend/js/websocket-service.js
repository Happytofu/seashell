/*
 * Angular bindings for the Seashell WebSocket client.
 * Copyright (C) 2013-2015 The Seashell Maintainers.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * See also 'ADDITIONAL TERMS' at the end of the included LICENSE file.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with self program.  If not, see <http://www.gnu.org/licenses/>.
 */
angular.module('seashell-websocket', ['ngCookies', 'seashell-local-files'])
  /**
   * WebSocket service:
   *  provides:
   *    register_disconnect_callback |
   *    register_reconnect_callback  | Callbacks to be invoked on change of socket connectivity.
   *    register_fail_callback       | 
   *    register_timein/out_callback |
   *    connect                      - Connects the socket
   *    socket                       - Socket object.  Is invalid after disconnect/fail | before connect.
   */
  .service('socket', ['$q', '$interval', '$cookies', '$timeout', 'localfiles', 
    function($q, $interval, $cookies, $timeout, localfiles) {
      "use strict";
      var self = this;

       
      self._socket = null;
      Object.defineProperty(self, 'socket', {
        get: function () {
          throw new ReferenceError("You forgot to replace something.");
        }
      });

      self.connected = false;
      self.failed = false;
      self.forceOffline = false;

      var timeout_count = 0;
      var timeout_interval = null;
      var key = 0;
      var callbacks = {};

      /** Registers callbacks to run when the socket has not seen activity
       *  in some while, and when messages are received after a timeout has passed.
       */
      self.register_callback = function(type, cb, now) {
        callbacks[key] = {
          type: type,
          cb: cb,
          now: now
        };

        if (type === 'disconnected' && !self.connected && now) {
          $timeout(cb, 0);
        } else if (type === 'connected' && self.connected && now) {
          $timeout(cb, 0);
        } else if (type === 'failed' && self.failed && now) {
          $timeout(cb, 0);
        }
        return key++;
      };
      self.unregister_callback = function(key) {
        delete callbacks[key];
      };

      /** Helper function to invoke the I/O callback. */
      function io_cb(ignored, message) {
        _.each(_.map(_.filter(callbacks, function(x) {
              return x.type === 'io';
            }),
            function(x) {
              return x.cb;
            }),
          function(x) {
            x(message);
          });
      }

      function test_cb(ignored, result) {
        _.each(_.map(_.filter(callbacks, function(x) {
              return x.type === 'test';
            }),
            function(x) {
              return x.cb;
            }),
          function(x) {
            x(result);
          });
      }

      /** Connects the socket, sets up the disconnection monitor. */
      self.connect = function() {
        if (!$cookies.get(SEASHELL_CREDS_COOKIE)) {
          self.failed = true;
          $timeout(function() {
            _.each(_.map(_.filter(callbacks, function(x) {
                  return x.type === 'failed';
                }),
                function(x) {
                  return x.cb;
                }),
              function(x) {
                x();
              });
          }, 0);
          return $q.reject("No credentials found!");
        }

        try {
          self._socket = new SeashellWebsocket(sprintf("wss://%s:%d", $cookies.getObject(SEASHELL_CREDS_COOKIE).host, $cookies.getObject(SEASHELL_CREDS_COOKIE).port),
            $cookies.getObject(SEASHELL_CREDS_COOKIE).key,
            /** Failure - probably want to prompt the user to attempt to reconnect/
             *  log in again.
             */
            function() {
              self.failed = true;
              $timeout(function() {
                $interval.cancel(timeout_interval);
                _.each(_.map(_.filter(callbacks, function(x) {
                      return x.type === 'failed';
                    }),
                    function(x) {
                      return x.cb;
                    }),
                  function(x) {
                    x();
                  });
              }, 0);
            },
            /** Socket closed - probably want to prompt the user to reconnect? */
            function() {
              self.connected = false;
              $timeout(function() {
                $interval.cancel(timeout_interval);
                _.each(_.map(_.filter(callbacks, function(x) {
                      return x.type === 'disconnected';
                    }),
                    function(x) {
                      return x.cb;
                    }),
                  function(x) {
                    x();
                  });
              }, 0);
            });
        } catch (e) {
          self.failed = true;
          $timeout(function() {
            _.each(_.map(_.filter(callbacks, function(x) {
                  return x.type === 'failed';
                }),
                function(x) {
                  return x.cb;
                }),
              function(x) {
                x();
              });
          }, 0);
          return $q.reject(e);
        }

        return $q.when(self._socket.ready)
          .then(function() {
            console.log("Seashell socket set up properly.");
            timeout_interval = $interval(function() {
              if (timeout_count++ === 3) {
                _.each(_.map(_.filter(callbacks, function(x) {
                      return x.type === 'timeout';
                    }),
                    function(x) {
                      return x.cb;
                    }),
                  function(x) {
                    x();
                  });
              }
              $q.when(self._socket.ping())
                .then(function() {
                  if (timeout_count >= 3) {
                    _.each(_.map(_.filter(callbacks, function(x) {
                          return x.type === 'timein';
                        }),
                        function(x) {
                          return x.cb;
                        }),
                      function(x) {
                        x();
                      });
                  }
                  timeout_count = 0;
                });
            }, 4000);
            self.connected = true;
            self.failed = false;
            self._socket.requests[-3].callback = io_cb;
            self._socket.requests[-4].callback = test_cb;
            console.log("Websocket disconnection monitor set up properly.");
            /** Run the callbacks. */
            _.each(_.map(_.filter(callbacks, function(x) {
                  return x.type === 'connected';
                }),
                function(x) {
                  return x.cb;
                }),
              function(x) {
                x();
              });
          });
      };

      self.isConnected = function() {
        return self.connected;
      };


      // Functions that are prefixed with offline or online
      //   have that functionality only. Functions with no
      //   prefix have offline and online functionality.
      //   That way, functions that have need special cases for 
      //   online/offline be called separately, whereas the trivial
      //   cases can be handled in here.
     
      self.ping = function(deferred) {
        // TODO: is this even used?
        return self._socket.ping(deferred);
      };

      self.compileAndRunProject = function(project, question, test, deferred) {
        // TODO: offline runner
        return self._socket.compileAndRunProject(project, question, test, deferred);
      };

      self.programKill = function(pid, deferred) {
        // TODO: offline runner
        return self._socket.programKill(pid, deferred);
      };

      self.sendEOF = function(pid, deferred) {
        // TODO: offline runner
        return self._socket.sendEOF(pid, deferred);
      };

      self.compileProject = function(project, file, deferred) {
        // TODO: offline runner
        return self._socket.compileProject(project, file, deferred);
      };

      self.saveProject = function(project, message, deferred) {
        // TODO: is this even used? 
        if (self.connected) {
          return self._socket.saveProject(project, message, deferred);
        } else {
          return $q.resolve(false); // noop 
        }
      };

      self.getProjects = function(deferred) {
        if (self.connected && !self.forceOffline) {
          return self._socket.getProjects(deferred)
          .then(function(projects) {
            localfiles.setProjects(projects);
            return projects;
          });
        }
        else { 
          return localfiles.getProjects();
        }
      };

      self.listProject = function(name, deferred) {
        if (self.connected && !self.forceOffline) {
          localfiles.listProject(name).then(
              function(tree) {
                console.log("[websocket] offline listProject", tree);
              });
          return self._socket.listProject(name, deferred);
        } else {
          return localfiles.listProject(name);
        }
      };

      self.newProject = function(name, deferred) {
        // TODO: offline mode (tree in storage-service) 
        localfiles.newProject(name);
        return self._socket.newProject(name, deferred);
      };

      self.newProjectFrom = function(name, src_url, deferred) {
        // TODO: disable? 
        return self._socket.newProjectFrom(name, src_url, deferred);
      };

      self.deleteProject = function(name, deferred) {
        // TODO: offline mode (tree in storage-service) 
        return self._socket.deleteProject(name, deferred);
      };

      self.lockProject = function(name, deferred) {
        // TODO: offline mode?
        return self._socket.lockProject(name, deferred);
      };

      self.forceLockProject = function(name, deferred) {
        // TODO: offline mode?
        return self._socket.forceLockProject(name, deferred);
      };

      self.unlockProject = function(name, deferred) {
        // TODO: offline mode?
        return self._socket.unlockProject(name, deferred);
      };


      // These two functions are provided separately
      // because code for handling online/offline stuff
      // is compilcated and needs to be dealt with in project-service
      self.onlineReadFile = function(name, file_name, deferred) {
        if (self.forceOffline) return $q.reject();
        return self._socket.readFile(name, file_name, deferred);
      };

      self.offlineReadFile = function(name, file_name, deferred) {
        return localfiles.readFile(name, file_name);
      };

      self.newFile = function(name, file_name, contents,
        encoding, normalize, deferred) {
        localfiles.newFile(name, file_name, contents, encoding, normalize);
        return self._socket.newFile(name, file_name, contents,
          encoding, normalize, deferred);
      };

      self.restoreFileFrom = function(projectName, fpath, url) {
        // TODO: disable in offline mode
        return self._socket.restoreFileFrom(projectName, fpath, url);
      };


      self.newDirectory = function(name, dir_name, deferred) {
        // TODO: offline mode (tree in storage-service) 
        localfiles.newDirectory(name, dir_name);
        return self._socket.newDirectory(name, dir_name, deferred);
      };

      self.writeFile = function(name, file_name, file_content, deferred) {
        var offlineWrite = function(checksum) {
          localfiles.writeFile(name, file_name, file_content, checksum);
          return checksum;
        };

        if (self.forceOffline) return $q.when(offlineWrite(false));

        return $q.when(self._socket.writeFile(name, file_name, file_content, deferred))
          .then(offlineWrite)  // get checksum from backend and write
          .catch(function () { offlineWrite(false); }); // force write
      };

      self.deleteFile = function(name, file_name, deferred) {
        localfiles.deleteFile(name, file_name);
        return self._socket.deleteFile(name, file_name, deferred);
      };

      self.deleteDirectory = function(name, dir_name, deferred) {
        // TODO: offline mode (tree in storage-service) 
        return self._socket.deleteDirectory(name, dir_name, deferred);
      };

      self.programInput = function(pid, contents, deferred) {
        // TODO: offline runner
        return self._socket.programInput(pid, contents, deferred);
      };

      self.getExportToken = function(project, deferred) {
        // TODO: just disable this for offline mode?
        return self._socket.getExportToken(project, deferred);
      };

      self.getUploadFileToken = function(project, file, deferred) {
        // TODO: just disable this for offline mode
        if (self.connected) {
          return self._socket.getUploadFileToken(project, file, deferred);
        } else {
          return $q.reject("Functionality not available offline");
        }
      };

      self.renameFile = function(project, oldName, newName, deferred) {
        var offlineResult = localfiles.renameFile(project, oldName, newName);
        if (self.connected && !self.forceOffline) {
          var onlineResult = self._socket.renameFile(project, oldName, newName, deferred);
          return $q.all([onlineResult, offlineResult]);
        } else {
          return $q.all([offlineResult]);
        }
      };

      self.getMostRecentlyUsed = function(project, directory, deferred) {
        // TODO: offline mode 
        return self._socket.getMostRecentlyUsed(project, directory, deferred);
      };

      self.updateMostRecentlyUsed = function(project, directory, predicate, data, deferred) {
        // TODO: offline mode (see renameFile for pattern to use here)
        return self._socket.updateMostRecentlyUsed(project, directory, predicate, data, deferred);
      };

      self.saveSettings = function(settings, deferred) {
        // TODO: offline mode
        return self._socket.saveSettings(settings, deferred);
      };

      self.getSettings = function(deferred) {
        // TODO: offline mode
        return self._socket.getSettings(deferred);
      };

      self.marmosetSubmit = function(project, assn, subdir, deferred) {
        // TODO: disable for offline mode
        return self._socket.marmosetSubmit(project, assn, subdir, deferred);
      };

      self.startIO = function(project, pid, deferred) {
        //  TODO: offline runner
        return self._socket.startIO(project, pid, deferred);
      };

      self.archiveProjects = function(deferred) {
        // TODO: disable for offline mode
        return self._socket.archiveProjects(deferred);
      };

      self.getFileToRun = function(project, question, deferred) {
        var offlineResult = localfiles.getRunnerFile(project, question);
        if (self.connected && !self.forceOffline) {
          var onlineResult = self._socket.getFileToRun(project, question, deferred);
          return $q.all([onlineResult, offlineResult]).catch(
            function(error) {
              // TODO: what if one of them doesn't resolve?
            });
        } else {
          return $q.all([offlineResult]);
        }
      };

      self.setFileToRun = function(project, question, folder, file, deferred) {
        var offlineResult = localfiles.setRunnerFile(project, question, folder, file);
        if (self.connected && !self.forceOffline) {
          var onlineResult = self._socket.setFileToRun(project, question, folder, file, deferred);
          return $q.all([onlineResult, offlineResult]).catch(
            function(error) {
              // TODO: what if one of them doesn't resolve?
            });
        } else {
          return $q.all([offlineResult]);
        }
      };

      self.forceOfflineMode = function(force) {
        self.forceOffline = force;
      };
    }
  ]);
