//Stored Procedures
//sp_CheckInPassenger-31
//Check-in butonuna basıldığında çalışır. 24 saat kuralını ve koltuk çakışmasını kontrol eder.

//sp_CreateBooking-25
//İlk bilet alım işlemi sırasında çağrılır.

//sp_CancelBookinG-28
//İptal işleminde Booking tablosunu günceller ve eğer varsa loglama yapar.

//sp_GetFlightPassengers-39
// Admin panelinde yolcu listesini getirir. EXEC sp_GetFlightPassengers :id şeklinde çağrılır.


//sp_CreateFlight NOT
//Projeye sonradan "Öğrenci Fiyatı" ve "Çocuk Fiyatı" sütunlarını ekledim bu yüzden, 
//Java tarafında SP yerine güncel bir INSERT sorgusu (createFlightRaw) yazdım. 
//SP veritabanında mevcut ve çalışır durumda (SQL üzerinden insert yapmak istersek kullanabiliriz) 
//ama Java tarafı şu an dinamik sorgu kullanıyor.


package com.skyfull.repository;

import com.skyfull.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.query.Procedure;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Integer> {
        List<Booking> findByUserId(Integer userId);

        @Procedure(procedureName = "sp_CreateBooking")
        void createBooking(Integer userId, String flightCode, String seatNumber, String passengerType);

        @Procedure(procedureName = "sp_CancelBooking")
        void cancelBooking(Integer bookingId);

        @Procedure(procedureName = "sp_CheckInPassenger")
        void checkInPassenger(Integer bookingId);

        // Custom query to get passengers for a flight (Admin feature)
        // Custom query to get passengers for a flight (Admin feature)
        // [UPDATED]: Now uses Stored Procedure for cleaner logic
        @Query(value = "EXEC sp_GetFlightPassengers :flightId", nativeQuery = true)
        List<Object[]> getFlightPassengers(
                        @org.springframework.data.repository.query.Param("flightId") Integer flightId);

        @Query(value = "SELECT b.BookingID, COALESCE(b.PassengerName, u.FullName), b.PassengerType, b.SeatNumber, b.Status "
                        +
                        "FROM Bookings b " +
                        "JOIN Users u ON b.UserID = u.UserID " +
                        "JOIN Flights f ON b.FlightID = f.FlightID " +
                        "WHERE f.FlightCode = :flightCode", nativeQuery = true)
        List<Object[]> getFlightPassengersByCode(
                        @org.springframework.data.repository.query.Param("flightCode") String flightCode);

        // Custom query to get user bookings with flight details (User feature)
        // Custom query to get user bookings with flight details (User feature)
        @Query(value = "SELECT b.BookingID, f.FlightCode, ao.Code AS Origin, ad.Code AS Dest, " +
                        "f.DepartureTime, b.SeatNumber, b.Status, b.TicketPrice, COALESCE(b.PassengerName, u.FullName) "
                        +
                        "FROM Bookings b " +
                        "JOIN Users u ON b.UserID = u.UserID " +
                        "JOIN Flights f ON b.FlightID = f.FlightID " +
                        "JOIN Airports ao ON f.OriginID = ao.AirportID " +
                        "JOIN Airports ad ON f.DestinationID = ad.AirportID " +
                        "WHERE b.UserID = :userId " +
                        "ORDER BY b.BookingDate DESC", nativeQuery = true)
        List<Object[]> findUserBookingsWithDetails(
                        @org.springframework.data.repository.query.Param("userId") Integer userId);

        @Query(value = "SELECT b.BookingID, f.FlightCode, ao.Code, ad.Code, " +
                        "f.DepartureTime, b.SeatNumber, b.Status, b.TicketPrice, COALESCE(b.PassengerName, u.FullName) "
                        +
                        "FROM Bookings b " +
                        "JOIN Users u ON b.UserID = u.UserID " +
                        "JOIN Flights f ON b.FlightID = f.FlightID " +
                        "JOIN Airports ao ON f.OriginID = ao.AirportID " +
                        "JOIN Airports ad ON f.DestinationID = ad.AirportID " +
                        "WHERE b.BookingID = :bookingId", nativeQuery = true)
        List<Object[]> findBookingDetailsById(
                        @org.springframework.data.repository.query.Param("bookingId") Integer bookingId);

        @Query(value = "SELECT b.SeatNumber FROM Bookings b JOIN Flights f ON b.FlightID = f.FlightID WHERE f.FlightCode = :flightCode AND b.Status <> 'CANCELLED'", nativeQuery = true)
        List<String> getOccupiedSeats(@org.springframework.data.repository.query.Param("flightCode") String flightCode);

        @Modifying
        @org.springframework.transaction.annotation.Transactional
        @Query(value = "INSERT INTO Bookings (UserID, FlightID, SeatNumber, BookingDate, Status, TicketPrice, PassengerType, PassengerName) "
                        +
                        "VALUES (:#{#b.userId}, :#{#b.flightId}, :#{#b.seatNumber}, :#{#b.bookingDate}, :#{#b.status}, :#{#b.ticketPrice}, :#{#b.passengerType}, :#{#b.passengerName})", nativeQuery = true)
        void createBookingRaw(@org.springframework.data.repository.query.Param("b") com.skyfull.entity.Booking b);
}
