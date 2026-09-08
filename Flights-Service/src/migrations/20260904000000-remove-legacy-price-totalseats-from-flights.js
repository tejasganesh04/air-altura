'use strict';

/*
 * Removes the legacy Flights.price / Flights.totalSeats columns.
 *
 * These were mirrors of the economy FlightClass row, kept during the v1 → v2
 * (multi-cabin) migration so old callers reading flight.price/totalSeats
 * directly wouldn't break. Confirmed no remaining real reader depends on
 * them (Booking Service already reads flightClass.price/totalSeats; the two
 * frontend fallbacks were defensive-only, since FlightClasses is an INNER
 * JOIN on every query a flight is ever returned from). Real, authoritative
 * pricing/seat-count lives entirely on FlightClasses now.
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.removeColumn('Flights', 'price');
        await queryInterface.removeColumn('Flights', 'totalSeats');
    },

    async down(queryInterface, Sequelize) {
        // Restores the columns' structure only — the original per-row values
        // are gone for good once removeColumn runs; that data loss is accepted.
        await queryInterface.addColumn('Flights', 'price', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        });
        await queryInterface.addColumn('Flights', 'totalSeats', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        });
    }
};
