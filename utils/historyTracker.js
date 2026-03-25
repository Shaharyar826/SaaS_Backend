/**
 * Utility to track history of changes in the application
 * @param {Object} options - History tracking options
 * @param {string} options.action - The action performed (create, update, delete)
 * @param {string} options.model - The model name (Gallery, User, etc.)
 * @param {string} options.documentId - The ID of the document being modified
 * @param {Object} options.changes - The changes made
 * @param {string} options.userId - The ID of the user making the changes
 * @returns {Object} - The history entry
 */
const trackHistory = async (options) => {
  try {
    const { action, model, documentId, changes, userId } = options;

    // Create history entry
    const historyEntry = {
      action,
      model,
      documentId,
      changes,
      userId,
      timestamp: new Date()
    };

    // In a real application, you would save this to a History/Audit collection
    // For now, we'll just log it
    console.log('History tracked:', historyEntry);

    return historyEntry;
  } catch (error) {
    console.error('Error tracking history:', error);
    // Don't throw the error, just log it
    return null;
  }
};

module.exports = {
  trackHistory
}; 