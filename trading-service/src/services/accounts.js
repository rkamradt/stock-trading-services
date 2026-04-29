'use strict';

const ordersService = require('./orders');

/**
 * Accounts service — trade order lifecycle view scoped to a brokerage account.
 *
 * This service does NOT maintain its own in-memory store for account records
 * (account identity is owned by AccountService). Instead it provides a
 * query layer over the shared order/trade stores maintained by the orders
 * service, filtered by accountId.
 *
 * All functions are pure — no HTTP knowledge.
 */

/**
 * Get all orders submitted for a given brokerage account.
 *
 * @param {string} accountId
 * @returns {Promise<Order[]>}
 */
async function getOrdersForAccount(accountId) {
  const accountOrders = ordersService.getOrdersByAccountId(accountId);
  // Return the list (may be empty — that is valid, not a 404)
  return accountOrders;
}

/**
 * Get the complete trade execution history for a given brokerage account.
 *
 * Each entry represents a single fill / partial fill and maps 1-to-1 with a
 * trade.executed event that was emitted at execution time.
 *
 * @param {string} accountId
 * @returns {Promise<Trade[]>}
 */
async function getTradesForAccount(accountId) {
  const accountTrades = ordersService.getTradesByAccountId(accountId);
  return accountTrades;
}

module.exports = {
  getOrdersForAccount,
  getTradesForAccount,
};
