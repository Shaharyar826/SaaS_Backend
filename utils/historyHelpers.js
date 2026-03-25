const History = require('../models/History');

/**
 * Track history for entity creation
 * @param {String} entityType - Type of entity (Meeting, EventNotice)
 * @param {Object} entity - The created entity
 * @param {String} userId - ID of the user who created the entity
 * @param {String} description - Optional description
 * @returns {Promise<Object>} - Created history record
 */
exports.trackCreation = async (entityType, entity, userId, description = '') => {
  try {
    const history = await History.create({
      entityType,
      entityId: entity._id,
      action: 'create',
      performedBy: userId,
      newState: entity,
      description: description || `${entityType} created`
    });
    
    return history;
  } catch (error) {
    console.error(`Error tracking creation history for ${entityType}:`, error);
    // Don't throw error to prevent disrupting the main flow
    return null;
  }
};

/**
 * Track history for entity update
 * @param {String} entityType - Type of entity (Meeting, EventNotice)
 * @param {Object} previousState - The entity before update
 * @param {Object} newState - The entity after update
 * @param {String} userId - ID of the user who updated the entity
 * @param {String} description - Optional description
 * @returns {Promise<Object>} - Created history record
 */
exports.trackUpdate = async (entityType, previousState, newState, userId, description = '') => {
  try {
    // Calculate changes
    const changes = [];
    const previousObj = previousState.toObject ? previousState.toObject() : previousState;
    const newObj = newState.toObject ? newState.toObject() : newState;
    
    // Compare fields and identify changes
    Object.keys(newObj).forEach(key => {
      // Skip certain fields
      if (['_id', '__v', 'createdAt', 'updatedAt'].includes(key)) {
        return;
      }
      
      // Check if the field exists in both objects and has changed
      if (previousObj[key] !== undefined && 
          JSON.stringify(previousObj[key]) !== JSON.stringify(newObj[key])) {
        changes.push({
          field: key,
          oldValue: previousObj[key],
          newValue: newObj[key]
        });
      }
      
      // Check if the field is new
      if (previousObj[key] === undefined && newObj[key] !== undefined) {
        changes.push({
          field: key,
          oldValue: null,
          newValue: newObj[key]
        });
      }
    });
    
    // Check for deleted fields
    Object.keys(previousObj).forEach(key => {
      if (!['_id', '__v', 'createdAt', 'updatedAt'].includes(key) && 
          newObj[key] === undefined) {
        changes.push({
          field: key,
          oldValue: previousObj[key],
          newValue: null
        });
      }
    });
    
    // Create history record
    const history = await History.create({
      entityType,
      entityId: newState._id,
      action: 'update',
      performedBy: userId,
      previousState: previousObj,
      newState: newObj,
      changes,
      description: description || `${entityType} updated`
    });
    
    return history;
  } catch (error) {
    console.error(`Error tracking update history for ${entityType}:`, error);
    // Don't throw error to prevent disrupting the main flow
    return null;
  }
};

/**
 * Track history for entity deletion
 * @param {String} entityType - Type of entity (Meeting, EventNotice)
 * @param {Object} entity - The deleted entity
 * @param {String} userId - ID of the user who deleted the entity
 * @param {String} description - Optional description
 * @returns {Promise<Object>} - Created history record
 */
exports.trackDeletion = async (entityType, entity, userId, description = '') => {
  try {
    const history = await History.create({
      entityType,
      entityId: entity._id,
      action: 'delete',
      performedBy: userId,
      previousState: entity,
      description: description || `${entityType} deleted`
    });
    
    return history;
  } catch (error) {
    console.error(`Error tracking deletion history for ${entityType}:`, error);
    // Don't throw error to prevent disrupting the main flow
    return null;
  }
};

/**
 * Track history for entity cancellation (e.g., meeting)
 * @param {String} entityType - Type of entity (Meeting, EventNotice)
 * @param {Object} previousState - The entity before cancellation
 * @param {Object} newState - The entity after cancellation
 * @param {String} userId - ID of the user who cancelled the entity
 * @param {String} description - Optional description
 * @returns {Promise<Object>} - Created history record
 */
exports.trackCancellation = async (entityType, previousState, newState, userId, description = '') => {
  try {
    const history = await History.create({
      entityType,
      entityId: newState._id,
      action: 'cancel',
      performedBy: userId,
      previousState,
      newState,
      description: description || `${entityType} cancelled`
    });
    
    return history;
  } catch (error) {
    console.error(`Error tracking cancellation history for ${entityType}:`, error);
    // Don't throw error to prevent disrupting the main flow
    return null;
  }
};
