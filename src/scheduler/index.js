/**
 * index.js
 *
 * Public interface for the scheduler module.
 * Import from here, not from individual files.
 *
 * Usage:
 *   const { suggestSlot, computeScore, mergeIntervals } = require('./scheduler')
 */
const { mergeIntervals }     = require('./mergeIntervals')
const { getFreeSlots }       = require('./getFreeSlots')
const { canFitBlock }        = require('./canFitBlock')
const { findCandidateSlots } = require('./findCandidateSlots')
const { computeScore }       = require('./computeScore')
const { suggestSlot }        = require('./suggestSlot')

module.exports = {
    mergeIntervals,
    getFreeSlots,
    canFitBlock,
    findCandidateSlots,
    computeScore,
    suggestSlot,
}
