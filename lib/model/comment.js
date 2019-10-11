
'use strict';

const
  Bluebird = require('bluebird'),
  Models = require('./db');

const commentLeave = ({leave, comment, companyId}) => {
  console.log('here', comment);
  return Models.Comment.create({
    entityType: Models.Comment.getEntityTypeLeave(),
    entityId: leave.id,
    comment,
    companyId,
    byUserId: leave.userId,
  });
};

const getCommentsForLeave = ({leave}) => {
  return Models.Comment.findAll({
    raw: true,
    where : {
      entityType: Models.Comment.getEntityTypeLeave(),
      entityId: leave.id,
    },
  });
};

module.exports = {
  commentLeave,
  getCommentsForLeave,
};
