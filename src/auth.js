devise.provider('Auth', function AuthProvider() {
    /**
     * The default paths.
     */
    var paths = {
        login: '/users/sign_in.json',
        logout: '/users/sign_out.json',
        update: '/users.json',
        register: '/users.json',
        sendResetPasswordInstructions: '/users/password.json',
        resetPassword: '/users/password.json'
    };

    /**
     * The default HTTP methods to use.
     */
    var methods = {
        login: 'POST',
        logout: 'DELETE',
        update: 'PUT',
        register: 'POST',
        sendResetPasswordInstructions: 'POST',
        resetPassword: 'PUT'
    };

    /**
     * Set to true if 401 interception of the provider is not desired
     */
    var ignoreAuth = false;

    /**
     * The parsing function used to turn a $http
     * response into a "user".
     *
     * Can be swapped with another parsing function
     * using
     *
     *  angular.module('myModule', ['Devise']).
     *  config(function(AuthProvider) {
     *      AuthProvider.parse(function(response) {
     *          return new User(response.data);
     *      });
     *  });
     */
    var _parse = function(response) {
        return response.data;
    };

    // A helper function that will setup the ajax config
    // and merge the data key if provided
    function httpConfig(action, data) {
        var config = {
            method: methods[action].toLowerCase(),
            url: paths[action],
            ignoreAuth: ignoreAuth
        };
        if (data) { config.data = data; }
        return config;
    }

    // A helper function to define our configure functions.
    // Loops over all properties in obj, and creates a get/set
    // method for [key + suffix] to set that property on obj.
    function configure(obj, suffix) {
        angular.forEach(obj, function(v, action) {
            this[action + suffix] = function(param) {
                if (param === undefined) {
                    return obj[action];
                }
                obj[action] = param;
                return this;
            };
        }, this);
    }
    configure.call(this, methods, 'Method');
    configure.call(this, paths, 'Path');

    // The ignoreAuth config function
    this.ignoreAuth = function(value) {
        if (value === undefined) {
            return ignoreAuth;
        }
        ignoreAuth = !!value;
        return this;
    };

    // The parse configure function.
    this.parse = function(fn) {
        if (typeof fn !== 'function') {
            return _parse;
        }
        _parse = fn;
        return this;
    };

    // Creates a function that always
    // returns a given arg.
    function constant(arg) {
        return function() {
            return arg;
        };
    }

    this.$get = function($q, $http, $rootScope) {
        // Our shared save function, called
        // by `then`s. Will return the first argument,
        // unless it is falsey (then it'll return
        // the second).
        function save(user) {
            service._currentUser = user;
            return user;
        }
        // A reset that saves null for currentUser
        function reset() {
            save(null);
        }

        function broadcast(name) {
            return function(data) {
                $rootScope.$broadcast('devise:' + name, data);
                return data;
            };
        }

        var service = {
            /**
             * The Auth service's current user.
             * This is shared between all instances of Auth
             * on the scope.
             */
            _currentUser: null,

            /**
             * The Auth service's parsing function.
             * Defaults to the parsing function set in the provider,
             * but may also be overwritten directly on the service.
             */
            parse: _parse,

            /**
             * The Auth service's current promise
             * This is shared between all instances of Auth
             * on the scope.
             */
            _promise: null,

            /**
             * A login function to authenticate with the server.
             * Keep in mind, credentials are sent in plaintext;
             * use a SSL connection to secure them. By default,
             * `login` will POST to '/users/sign_in.json'.
             *
             * The path and HTTP method used to login are configurable
             * using
             *
             *  angular.module('myModule', ['Devise']).
             *  config(function(AuthProvider) {
             *      AuthProvider.loginPath('path/on/server.json');
             *      AuthProvider.loginMethod('GET');
             *  });
             *
             * @param {Object} [creds] A hash of user credentials.
             * @returns {Promise} A $http promise that will be resolved or
             *                  rejected by the server.
             */
            login: function(creds) {
                var withCredentials = arguments.length > 0,
                    loggedIn = service.isAuthenticated();

                creds = creds || {};
                return $http(httpConfig('login', {user: creds}))
                    .then(service.parse)
                    .then(save)
                    .then(function(user) {
                        if (withCredentials && !loggedIn) {
                            return broadcast('new-session')(user);
                        }
                        return user;
                    })
                    .then(broadcast('login'));
            },

            /**
             * A logout function to de-authenticate from the server.
             * By default, `logout` will DELETE to '/users/sign_out.json'.
             *
             * The path and HTTP method used to logout are configurable
             * using
             *
             *  angular.module('myModule', ['Devise']).
             *  config(function(AuthProvider) {
             *      AuthProvider.logoutPath('path/on/server.json');
             *      AuthProvider.logoutMethod('GET');
             *  });
             * @returns {Promise} A $http promise that will be resolved or
             *                  rejected by the server.
             */
            logout: function() {
                var returnOldUser = constant(service._currentUser);
                return $http(httpConfig('logout'))
                    .then(reset)
                    .then(returnOldUser)
                    .then(broadcast('logout'));
            },

            /**
             * A register function to register and authenticate
             * with the server. Keep in mind, credentials are sent
             * in plaintext; use a SSL connection to secure them.
             * By default, `register` will POST to '/users.json'.
             *
             * The path and HTTP method used to login are configurable
             * using
             *
             *  angular.module('myModule', ['Devise']).
             *  config(function(AuthProvider) {
             *      AuthProvider.registerPath('path/on/server.json');
             *      AuthProvider.registerMethod('GET');
             *  });
             *
             * @param {Object} [creds] A hash of user credentials.
             * @returns {Promise} A $http promise that will be resolved or
             *                  rejected by the server.
             */
            register: function(creds) {
                creds = creds || {};
                return $http(httpConfig('register', {user: creds}))
                    .then(service.parse)
                    .then(save)
                    .then(broadcast('new-registration'));
            },

            /**
             * A update function to update user data
             * with the server. Keep in mind, credentials are sent
             * in plaintext; use a SSL connection to secure them.
             * By default, `update` will PUT to '/users.json'.
             *
             * The path and HTTP method used to login are configurable
             * using
             *
             *  angular.module('myModule', ['Devise']).
             *  config(function(AuthProvider) {
             *      AuthProvider.updatePath('path/on/server.json');
             *      AuthProvider.updateMethod('PUT');
             *  });
             *
             * @param {Object} [creds] A hash of user credentials.
             * @returns {Promise} A $http promise that will be resolved or
             *                  rejected by the server.
             */
            update: function(creds) {
                creds = creds || {};
                return $http(httpConfig('update', {user: creds}))
                    .then(service.parse)
                    .then(save)
                    .then(broadcast('update-successfully'));
            },

            /**
             * A function to send the reset password instructions to the
             * user email. Keep in mind, credentials are sent
             * in plaintext; use a SSL connection to secure them.
             * By default, `sendResetPasswordInstructions` will POST to '/users/password.json'.
             *
             * The path and HTTP method used to send instructions are configurable
             * using
             *
             *  angular.module('myModule', ['Devise']).
             *  config(function(AuthProvider) {
             *      AuthProvider.sendResetPasswordInstructionsPath('path/on/server.json');
             *      AuthProvider.sendResetPasswordInstructionsMethod('POST');
             *  });
             *
             * @param {Object} [creds] A hash containing user email.
             * @returns {Promise} A $http promise that will be resolved or
             *                  rejected by the server.
             */
            sendResetPasswordInstructions: function(creds) {
                creds = creds || {};
                return $http(httpConfig('sendResetPasswordInstructions', {user: creds}))
                    .then(service.parse)
                    .then(broadcast('send-reset-password-instructions-successfully'));
            },

            /**
             * A reset function to reset user password.
             * Keep in mind, credentials are sent
             * in plaintext; use a SSL connection to secure them.
             * By default, `update` will PUT to '/users/password.json'.
             *
             * The path and HTTP method used to reset password are configurable
             * using
             *
             *  angular.module('myModule', ['Devise']).
             *  config(function(AuthProvider) {
             *      AuthProvider.resetPasswordPath('path/on/server.json');
             *      AuthProvider.resetPasswordMethod('POST');
             *  });
             *
             * @param {Object} [creds] A hash containing password, password_confirmation and reset_password_token.
             * @returns {Promise} A $http promise that will be resolved or
             *                  rejected by the server.
             */
            resetPassword: function(creds) {
                creds = creds || {};
                return $http(httpConfig('resetPassword', {user: creds}))
                    .then(service.parse)
                    .then(save)
                    .then(broadcast('reset-password-successfully'));
            },

            /**
             * A helper function that will return a promise with the currentUser.
             * Three different outcomes can happen:
             *  1. Auth has authenticated a user, and will resolve with it
             *  2. Auth has not authenticated a user but the server has an
             *      authenticated session, Auth will attempt to retrieve that
             *      session and resolve with its user.
             *  3. Neither Auth nor the server has an authenticated session,
             *      and will reject with an unauthenticated error.
             *
             * @returns {Promise} A $http promise that will be resolved or
             *                  rejected by the server.
             */
            currentUser: function() {
                if (service.isAuthenticated()) {
                    return $q.when(service._currentUser);
                }
                if(service._promise == null){
                    service._promise = service.login();
                }
                return service._promise;
            },

            /**
             * A helper function to determine if a currentUser is present.
             *
             * @returns Boolean
             */
            isAuthenticated: function(){
                return !!service._currentUser;
            }
        };

        return service;
    };
});
