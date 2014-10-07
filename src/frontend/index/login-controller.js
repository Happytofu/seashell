/**
 * Seashell's login tools.
 * Copyright (C) 2013-2014 The Seashell Maintainers.
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
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
angular.module('loginForm', [])
  .controller('LoginController', ['$scope',
      function($scope) {
        "use strict";
        this.error = false;
        this.user ="";
        this.busy = false;
        this.login = function(user) {
          this.busy = true;
          this.error = false;
          var target = sprintf("https://%s%s/cgi-bin/login.cgi",
              document.location.host,
              document.location.pathname.substring(0, document.location.pathname.lastIndexOf('/')));
          $.ajax({url: target,
                  type: "POST",
                  data: {"u": user.user, "p": user.password},
                  dataType: "json"})
            .done(function(data) {
              $scope.$apply(function () {
                this.busy = false;
                if(data.error !== undefined) {
                  this.error = sprintf("An error was encountered while logging in: %s (code %d)", data.error.message,
                    data.error.code);
                } else if (data.port !== undefined) {
                  createCookie("seashell-session", JSON.stringify(data));
                  console.log("All done login!");
                  top.location = "frontend.html";
                } else {
                  this.error = "An internal error occurred: " + textStatus;
                }});
            }).fail(function(error) {
              $scope.$apply(function () {
                this.busy = false;
                this.error = error;
              });
            });
        };
      }]);
