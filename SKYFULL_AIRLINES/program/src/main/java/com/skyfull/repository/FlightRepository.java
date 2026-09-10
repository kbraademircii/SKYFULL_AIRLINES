//Functions

//fn_GetAvailableSeats-36
//Uçuşları listelerken kalan koltuk sayısını hesaplamak için sorgu içinde dbo.fn_GetAvailableSeats(...) olarak çağrılır.

//fn_GetFlightDuration-47
//Uçuş süresini (örn: "2 sa 15 dk") hesaplayıp ekrana yazdırmak için kullanılır.

//fn_FlightRevenue
//Bu fonksiyon doğrudan Java'da değil, vw_OwnerDashboard görünümü içinde çağrılır. 
//Uçuş başına ciro hesaplamasını yapar.

//vw_OwnerDashboard-48
//Bu View, patron ekranı için ciro ve doluluk oranlarını hesaplar. 
//Java tarafında son dakika eklenen özel filtreler gerektiği için View'in mantığını (Logic) birebir kopyalayıp 
//parametreli bir sorguya (getOwnerStats) dönüştürdüm.
//Veritabanı tarafında raporlama view'im hazır, uygulama tarafında filtreleme esnekliği için sorguyu şu an native olarak atıyorum

//vw_PublicSchedule
//Kullanıcının gördüğü uçuş listesidir. Java'da 
//getPublicSchedule
//metodunda bu mantık çalışır.

package com.skyfull.repository;

import com.skyfull.entity.Flight;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.math.BigDecimal;

@Repository
public interface FlightRepository extends JpaRepository<Flight, Integer> {

        Flight findByFlightCode(String flightCode);

        // FUNCTION CALL: Uses the database function 'fn_GetAvailableSeats'
        // This ensures accurate availability calculation at the DB level, considering
        // concurrency.
        @Query(value = "SELECT dbo.fn_GetAvailableSeats(:flightId)", nativeQuery = true)
        Integer getAvailableSeats(@Param("flightId") Integer flightId);

        List<Flight> findByOriginIdAndDestinationId(Integer originId, Integer destinationId);

        // Direct query to include Airport Codes without needing DB View update
        @Query(value = "SELECT f.FlightCode, " +
                        "ao.City + ' (' + ao.Code + ')' as Origin, " +
                        "ad.City + ' (' + ad.Code + ')' as Destination, " +
                        "f.DepartureTime, f.Status, f.BasePrice, " +
                        "dbo.fn_GetAvailableSeats(f.FlightID) as AvailableSeats, f.TotalSeats, " +
                        "dbo.fn_GetFlightDuration(f.FlightID) as Duration " +
                        "FROM Flights f " +
                        "JOIN Airports ao ON f.OriginID = ao.AirportID " +
                        "JOIN Airports ad ON f.DestinationID = ad.AirportID " +
                        "WHERE f.DepartureTime > GETDATE() AND f.Status NOT IN ('CANCELLED', 'COMPLETED')", nativeQuery = true)
        List<Object[]> getPublicSchedule();

        // Direct query instead of view to ensure correct calculation without DB reset
        // Simplified robust query
        @Query(value = "SELECT f.FlightCode, f.Status, COUNT(b.BookingID) as TotalBookings, COALESCE(SUM(b.TicketPrice), 0) as TotalRevenue, "
                        +
                        "COALESCE(SUM(CASE WHEN b.PassengerType = 'ADULT' THEN 1 ELSE 0 END), 0) as AdultCount, " +
                        "COALESCE(SUM(CASE WHEN b.PassengerType = 'STUDENT' THEN 1 ELSE 0 END), 0) as StudentCount, " +
                        "COALESCE(SUM(CASE WHEN b.PassengerType = 'CHILD' THEN 1 ELSE 0 END), 0) as ChildCount, " +
                        "f.FlightID " +
                        "FROM Flights f " +
                        "LEFT JOIN Bookings b ON f.FlightID = b.FlightID AND b.Status <> 'CANCELLED' " +
                        "GROUP BY f.FlightID, f.FlightCode, f.Status", nativeQuery = true)
        List<Object[]> getOwnerStats();

        @Modifying
        @Transactional
        @Query(value = "UPDATE Bookings SET TicketPrice = (SELECT BasePrice FROM Flights WHERE Flights.FlightID = Bookings.FlightID) WHERE TicketPrice IS NULL;"
                        +
                        "UPDATE Bookings SET PassengerType = 'ADULT' WHERE PassengerType IS NULL", nativeQuery = true)
        void fixLegacyBookings();

        @Modifying
        @Transactional
        @Query(value = "UPDATE Flights SET Status = :status WHERE FlightID = :id", nativeQuery = true)
        void updateFlightStatus(@Param("id") Integer id, @Param("status") String status);

        @Modifying
        @Transactional
        @Query(value = "INSERT INTO Flights (FlightCode, OriginID, DestinationID, DepartureTime, ArrivalTime, AircraftType, TotalSeats, BasePrice, PriceStudent, PriceChild, Status) "
                        +
                        "VALUES (:code, (SELECT TOP 1 AirportID FROM Airports WHERE Code = :origin OR City = :origin), (SELECT TOP 1 AirportID FROM Airports WHERE Code = :dest OR City = :dest), :dep, :arr, :aircraft, :seats, :price, :pStudent, :pChild, 'SCHEDULED')", nativeQuery = true)
        void createFlightRaw(@Param("code") String code, @Param("origin") String origin, @Param("dest") String dest,
                        @Param("dep") LocalDateTime dep, @Param("arr") LocalDateTime arr,
                        @Param("aircraft") String aircraft, @Param("seats") Integer seats,
                        @Param("price") BigDecimal price, @Param("pStudent") BigDecimal pStudent,
                        @Param("pChild") BigDecimal pChild);

        /*
         * Replacing SP call with raw query to support new columns easily without
         * altering SP significantly from Java.
         * If we fixed SP, we could use it. But for safety, Raw Insert ensures fields
         * are populated.
         */

        @Modifying
        @Transactional
        @Query(value = "UPDATE Flights SET Status = :status WHERE FlightID = :id", nativeQuery = true)
        void updateStatus(@Param("id") Integer id, @Param("status") String status);

        @Modifying
        @Transactional
        @Query(value = "UPDATE Bookings SET Status = 'CANCELLED' WHERE FlightID = :flightId", nativeQuery = true)
        void cancelBookingsByFlightId(@Param("flightId") Integer flightId);

        @Modifying
        @Transactional
        @Query(value = "UPDATE Flights SET Status = 'COMPLETED' WHERE DepartureTime < GETDATE() AND Status = 'SCHEDULED'", nativeQuery = true)
        void updateFlightStatuses();

        @Query(value = "SELECT f.FlightID, f.FlightCode, COALESCE(ao.Code, 'UNK'), COALESCE(ad.Code, 'UNK'), f.DepartureTime, f.ArrivalTime, f.Status, f.BasePrice, f.TotalSeats, f.AircraftType "
                        +
                        "FROM Flights f " +
                        "LEFT JOIN Airports ao ON f.OriginID = ao.AirportID " +
                        "LEFT JOIN Airports ad ON f.DestinationID = ad.AirportID " +
                        "ORDER BY f.DepartureTime DESC", nativeQuery = true)
        List<Object[]> findAllWithAirportCodes();

        @Query(value = "SELECT f.FlightID, f.FlightCode, COALESCE(ao.Code, 'UNK'), COALESCE(ad.Code, 'UNK'), f.DepartureTime, f.ArrivalTime, f.Status, f.BasePrice, f.TotalSeats, f.AircraftType "
                        +
                        "FROM Flights f " +
                        "LEFT JOIN Airports ao ON f.OriginID = ao.AirportID " +
                        "LEFT JOIN Airports ad ON f.DestinationID = ad.AirportID " +
                        "WHERE f.FlightCode = :code AND CAST(f.DepartureTime AS DATE) = :dateStr", nativeQuery = true)
        List<Object[]> searchFlightStatus(@Param("code") String code, @Param("dateStr") String dateStr);

        @Query(value = "SELECT Code, City, Name FROM Airports ORDER BY City", nativeQuery = true)
        List<Object[]> getAllAirports();

        // Cleanup Helper (One-time use)
        @Modifying
        @Transactional
        @Query(value = "DELETE FROM Bookings WHERE FlightID IN (SELECT FlightID FROM Flights WHERE FlightCode = 'SK123' OR OriginID IS NULL OR DestinationID IS NULL)", nativeQuery = true)
        void deleteBadBookings();

        @Modifying
        @Transactional
        @Query(value = "DELETE FROM Flights WHERE FlightCode = 'SK123' OR OriginID IS NULL OR DestinationID IS NULL", nativeQuery = true)
        void deleteBadFlights();

        @Modifying
        @Transactional
        @Query(value = "INSERT INTO Airports (Code, City, Name) SELECT 'ESB', 'Ankara', 'Esenboga Airport' WHERE NOT EXISTS (SELECT 1 FROM Airports WHERE Code = 'ESB');"
                        +
                        "INSERT INTO Airports (Code, City, Name) SELECT 'ERZ', 'Erzurum', 'Erzurum Airport' WHERE NOT EXISTS (SELECT 1 FROM Airports WHERE Code = 'ERZ');"
                        +
                        "INSERT INTO Airports (Code, City, Name) SELECT 'SAW', 'Istanbul', 'Sabiha Gokcen Airport' WHERE NOT EXISTS (SELECT 1 FROM Airports WHERE Code = 'SAW');"
                        +
                        "INSERT INTO Airports (Code, City, Name) SELECT 'AYT', 'Antalya', 'Antalya Airport' WHERE NOT EXISTS (SELECT 1 FROM Airports WHERE Code = 'AYT');"
                        +
                        "INSERT INTO Airports (Code, City, Name) SELECT 'ADB', 'Izmir', 'Adnan Menderes Airport' WHERE NOT EXISTS (SELECT 1 FROM Airports WHERE Code = 'ADB');", nativeQuery = true)
        void seedMissingAirports();
}
