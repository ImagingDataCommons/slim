#!/usr/bin/env bash

# Copyright 2020, Institute for Systems Biology
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Note that CIRCLE_PROJECT_REPONAME is a Circle CI built-in var:
export HOME=/home/circleci/${CIRCLE_PROJECT_REPONAME}
export HOMEROOT=/home/circleci/${CIRCLE_PROJECT_REPONAME}


# Install and update apt-get info
echo "Preparing System..."

apt-get update -qq
apt-get upgrade -y

apt-get install -y --no-install-suggests --no-install-recommends build-essential
apt-get install -y --no-install-suggests --no-install-recommends ca-certificates
apt-get install -y --no-install-suggests --no-install-recommends curl
apt-get install -y --no-install-suggests --no-install-recommends dumb-init
apt-get install -y --no-install-suggests --no-install-recommends gnupg
apt-get install -y --no-install-suggests --no-install-recommends git
#apt-get install -y --no-install-suggests --no-install-recommends nodejs
apt-get install -y --no-install-suggests --no-install-recommends apt-transport-https

apt-get clean

curl -sL https://deb.nodesource.com/setup_14.x | bash -
apt-get install -y nodejs

# See https://github.com/Joystream/helpdesk/issues/16
#sudo apt remove cmdtest
#sudo apt remove yarn

curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
apt-get update
apt-get install -y --no-install-suggests --no-install-recommends yarn
apt-get clean

echo "Libraries Installed"
