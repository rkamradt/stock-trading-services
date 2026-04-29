'use strict';

const accountsService = require('./accounts');

/**
 * Customer-scoped service operations.
 *
 * This module handles queries that are expressed through a customerId lens
 * (e.g. "all accounts for customer X"). It delegates actual account data
 * management to the accounts service and optionally enriches results by
 * calling the CustomerManagement service for customer details.
 */

/**
 * Retrieve all brokerage accounts that belong to a given customer.
 * Optionally cross-checks with CustomerManagement to confirm the customer
 * exists before returning results.
 *
 * @param {string} customerId
 * @returns {Promise<object[]>} Array of Account objects
 */
async function getAccountsByCustomerId(customerId) {
  // Optionally verify the customer exists in CustomerManagement
  const customerManagementUrl = process.env.CUSTOMER_MANAGEMENT_URL;
  if (customerManagementUrl) {
    try {
      const res = await fetch(`${customerManagementUrl}/customers/${encodeURIComponent(customerId)}`);
      if (res.status === 404) {
        const err = new Error(`Customer '${customerId}' not found`);
        err.status = 404;
        throw err;
      }
      if (!res.ok) {
        // CustomerManagement is reachable but returned an error — surface it
        console.warn(
          `[account-service] CustomerManagement returned ${res.status} for customerId '${customerId}'`
        );
      }
    } catch (fetchErr) {
      if (fetchErr.status === 404) throw fetchErr;
      // Network/timeout — degrade gracefully and serve from local store
      console.warn(
        `[account-service] Could not reach customer-management: ${fetchErr.message}. Proceeding with local data.`
      );
    }
  }

  const accounts = await accountsService.getAccountsByCustomerId(customerId);
  return accounts;
}

module.exports = {
  getAccountsByCustomerId,
};
