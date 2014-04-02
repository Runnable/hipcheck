FROM ubuntu

RUN sudo apt-get update
RUN sudo sudo apt-get install -y python-software-properties software-properties-common
RUN sudo add-apt-repository ppa:chris-lea/node.js
RUN sudo apt-get update
RUN sudo apt-get install -y python g++ make nodejs
RUN sudo npm install -g hipcheck

VOLUME [~/.hipcheck, /.hipcheck]

CMD hipcheck --help