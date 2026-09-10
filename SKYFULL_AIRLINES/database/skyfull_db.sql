/*
=============================================================================
   COURSE:       DATABASE MANAGEMENT SYSTEMS
   PROJECT:      SKYFULL AIRLINES RESERVATION SYSTEM
   STUDENT:      HATİCE KÜBRA DEMİRCİ
   STUDENT ID:   220709087
   
   DESCRIPTION:
   This SQL script initializes the complete backend for the Skyfull Airlines system.
   It creates the normalized schema, defines business logic using Stored Procedures,
   Triggers, Functions, and Views for data abstraction.
=============================================================================
*/


-- !!! 
-- Database Creation
-- INSTRUCTION: Create 'SkyfullDB' manually in SSMS (Right-click Databases -> New Database) if you don't have permission to create it via script.
-- IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'SkyfullDB')
-- BEGIN
--    CREATE DATABASE SkyfullDB;
-- END
-- GO
-- !!!

USE SkyfullDB;
GO

-- 0. SECURITY SETUP (Auto-create App User)
-- Here we automatically configure the 'airline_user' entry so that the Java application can connect 
-- seamlessly without the need for manual installation.


-- Verify we are in the correct DB context before creating the user
IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'airline_user')
BEGIN
    -- Only create login if it doesn't exist on the SERVER level
    IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'airline_user')
    BEGIN
        -- Create SQL Login with a fixed password for the project submission
        CREATE LOGIN airline_user WITH PASSWORD = 'Password123!', CHECK_POLICY = OFF;
    END
    ELSE
    BEGIN
        -- If exists, FORCE RESET password to ensure project connectivity
        ALTER LOGIN airline_user WITH PASSWORD = 'Password123!';
    END

    -- Create Database User linking to the Login
    CREATE USER airline_user FOR LOGIN airline_user;
    
    -- Grant Full Permissions (Simple for project demo)
    ALTER ROLE db_owner ADD MEMBER airline_user;
END
GO

-- 1. TABLES

-- TABLE: Users
-- Stores system users including Admins, Owners, and Passengers.
-- The 'Role' column enforces authorization logic in the application layer.

-- 1. TABLOLAR

-- TABLO: Kullanıcılar
-- Yöneticiler, Sahipler ve Yolcular dahil olmak üzere sistem kullanıcılarını saklar.

-- 'Rol' sütunu, uygulama katmanında yetkilendirme mantığını uygular.

CREATE TABLE Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(50) UNIQUE NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    FullName NVARCHAR(100),
    Role NVARCHAR(20) CHECK (Role IN ('ADMIN', 'USER', 'OWNER')),
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- TABLE: Airports
-- Acts as a lookup table for Flight Origins and Destinations.
-- Used to normalize city names and prevent data redundancy (3NF).

-- TABLO: Havaalanları
-- Uçuş Kalkış ve Varış Noktaları için arama tablosu görevi görür.
-- Şehir adlarını normalleştirmek ve veri tekrarını önlemek için kullanılır (3NF).

CREATE TABLE Airports (
    AirportID INT IDENTITY(1,1) PRIMARY KEY,
    Code NVARCHAR(3) UNIQUE NOT NULL,
    City NVARCHAR(50),
    Name NVARCHAR(100)
);

-- TABLE: Flights
-- The core entity representing flight schedules.
-- Links to the 'Airports' table twice (Origin and Destination) via Foreign Keys.

-- TABLO: Uçuşlar
-- Uçuş programlarını temsil eden temel varlık.
-- İkincil Anahtarlar aracılığıyla 'Havaalanları' tablosuna iki kez (Kalkış ve Varış) bağlanır.

CREATE TABLE Flights (
    FlightID INT IDENTITY(1,1) PRIMARY KEY,
    FlightCode NVARCHAR(10) UNIQUE NOT NULL,
    OriginID INT FOREIGN KEY REFERENCES Airports(AirportID),
    DestinationID INT FOREIGN KEY REFERENCES Airports(AirportID),
    DepartureTime DATETIME NOT NULL,
    ArrivalTime DATETIME NOT NULL,
    AircraftType NVARCHAR(50),
    TotalSeats INT NOT NULL,
    BasePrice DECIMAL(10, 2) NOT NULL,
    Status NVARCHAR(20) DEFAULT 'SCHEDULED' -- SCHEDULED, CANCELLED, COMPLETED
);

-- TABLE: Bookings
-- Stores transactional data linking Users to Flights.
-- Data integrity for 'SeatNumber' is strictly enforced by the trigger 'trg_PreventDoubleBooking'.

-- TABLO: Rezervasyonlar
-- Kullanıcıları Uçuşlara bağlayan işlem verilerini saklar.
-- 'Koltuk Numarası' için veri bütünlüğü, 'trg_PreventDoubleBooking' tetikleyicisi tarafından sıkı bir şekilde sağlanır.

CREATE TABLE Bookings (
    BookingID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT FOREIGN KEY REFERENCES Users(UserID),
    FlightID INT FOREIGN KEY REFERENCES Flights(FlightID),
    SeatNumber NVARCHAR(5),
    BookingDate DATETIME DEFAULT GETDATE(),
    Status NVARCHAR(20) DEFAULT 'CONFIRMED', -- CONFIRMED, CANCELLED, CHECKED_IN
    TicketPrice DECIMAL(10, 2),
    PassengerName NVARCHAR(100), -- Guest name or override
    PassengerType NVARCHAR(20) DEFAULT 'ADULT' -- ADULT, STUDENT, CHILD
);

-- TABLE: Logs
-- This table records system actions for security purposes.
-- For example, when a booking is cancelled, a trigger writes a record here.

-- TABLO: Kayıtlar
-- Bu tablo, güvenlik amacıyla sistem eylemlerini kaydeder.
-- Örneğin, bir rezervasyon iptal edildiğinde, bir tetikleyici buraya bir kayıt yazar.

CREATE TABLE Logs (
    LogID INT IDENTITY(1,1) PRIMARY KEY,
    Action NVARCHAR(100),
    Details NVARCHAR(MAX),
    LogDate DATETIME DEFAULT GETDATE()
);



GO

-- 2. STORED PROCEDURES (At least 5)

-- STORED PROCEDURE: CreateFlight
-- SP 1: Create a new flight (Admin)
-- Administrator use this to add new flights.
-- Instead of asking for numeric IDs, I designed it to accept Airport Codes (like 'IST', 'JFK') 
-- because it's easier for users. The SP automatically finds the correct IDs.

-- SAKLI PROSEDÜR: CreateFlight
-- SP 1: Yeni uçuş oluşturma (Yönetici)
-- Yöneticiler yeni uçuşlar eklemek için bunu kullanır.
-- Sayısal kimlikler istemek yerine, kullanıcılar için daha kolay olduğu için 
-- Havaalanı Kodlarını (örneğin 'IST', 'JFK') kabul edecek şekilde tasarladım.
-- SP otomatik olarak doğru kimlikleri bulur.

CREATE PROCEDURE sp_CreateFlight
    @FlightCode NVARCHAR(10),
    @OriginCode NVARCHAR(3),
    @DestCode NVARCHAR(3),
    @DepTime DATETIME,
    @ArrTime DATETIME,
    @Aircraft NVARCHAR(50),
    @Seats INT,
    @Price DECIMAL(10,2)
AS
BEGIN
    DECLARE @OriginID INT = (SELECT AirportID FROM Airports WHERE Code = @OriginCode);
    DECLARE @DestID INT = (SELECT AirportID FROM Airports WHERE Code = @DestCode);

    IF @OriginID IS NULL OR @DestID IS NULL
    BEGIN
        RAISERROR('Invalid Airport Code', 16, 1);
        RETURN;
    END

    INSERT INTO Flights (FlightCode, OriginID, DestinationID, DepartureTime, ArrivalTime, AircraftType, TotalSeats, BasePrice)
    VALUES (@FlightCode, @OriginID, @DestID, @DepTime, @ArrTime, @Aircraft, @Seats, @Price);
END;
GO


-- STORED PROCEDURE: RegisterUser
-- SP 2: Register a new user
-- Used for user registration.
-- Before inserting, I check if the username is already taken.
-- If it exists, I use RAISERROR to send a proper warning message back to the application.

-- SAKLI PROSEDÜR: Kullanıcıyı Kaydet
-- SP 2: Yeni bir kullanıcı kaydet
-- Kullanıcı kaydı için kullanılır.
-- Eklemeden önce, kullanıcı adının zaten alınmış olup olmadığını kontrol ediyorum.
-- Eğer varsa, uygulamaya uygun bir uyarı mesajı göndermek için RAISERROR kullanıyorum.

CREATE PROCEDURE sp_RegisterUser
    @Username NVARCHAR(50),
    @Password NVARCHAR(255),
    @FullName NVARCHAR(100),
    @Role NVARCHAR(20)
AS
BEGIN
    IF EXISTS (SELECT 1 FROM Users WHERE Username = @Username)
    BEGIN
        RAISERROR('Username already exists', 16, 1);
        RETURN;
    END

    INSERT INTO Users (Username, PasswordHash, FullName, Role)
    VALUES (@Username, @Password, @FullName, @Role);
END;
GO

-- STORED PROCEDURE: GetFlightPassengers
-- SP 3: Get Flight Passengers (Admin Panel)
-- Used in the Admin Panel to show passenger lists.
-- I used COALESCE() here because the passenger's name might be stored in the 'Bookings' table (for guests)
-- or the 'Users' table (for registered members). This function handles both cases automatically.

-- SAKLI PROSEDÜR: GetFlightPassengers
-- SP 3: Uçuş Yolcularını Al (Yönetici Paneli)
-- Yolcu listelerini göstermek için Yönetici Panelinde kullanılır.
-- Burada COALESCE() kullandım çünkü yolcunun adı 'Rezervasyonlar' tablosunda (misafirler için)
-- veya 'Kullanıcılar' tablosunda (kayıtlı üyeler için) saklanabilir. Bu fonksiyon her iki durumu da otomatik olarak ele alır.

CREATE PROCEDURE sp_GetFlightPassengers
    @FlightID INT
AS
BEGIN
    SELECT 
        b.BookingID, 
        COALESCE(b.PassengerName, u.FullName) AS PassengerName, 
        b.PassengerType, 
        b.SeatNumber, 
        b.Status 
    FROM Bookings b 
    JOIN Users u ON b.UserID = u.UserID 
    WHERE b.FlightID = @FlightID;
END;
GO


-- STORED PROCEDURE: CheckInPassenger
-- SP 4: Check-in User
-- Handles the Check-in process.
-- I implemented the "24-Hour Rule" directly in the database logic.
-- It strictly forbids check-in if the flight is more than 24 hours away or has already departed.

-- SAKLI PROSEDÜR: CheckInPassenger
-- SP 4: Check-in Kullanıcısı
-- Check-in işlemini yönetir.
-- "24 Saat Kuralı"nı doğrudan veritabanı mantığına entegre ettim.
-- Uçuşa 24 saatten fazla süre varsa veya uçuş zaten gerçekleşmişse check-in işlemini kesinlikle yasaklar.
CREATE PROCEDURE sp_CheckInPassenger
    @BookingID INT
AS
BEGIN
    DECLARE @FlightID INT;
    DECLARE @DepartureTime DATETIME;

    SELECT @FlightID = FlightID FROM Bookings WHERE BookingID = @BookingID;
    SELECT @DepartureTime = DepartureTime FROM Flights WHERE FlightID = @FlightID;

    -- Check if flight exists
    IF @DepartureTime IS NULL
    BEGIN
        RAISERROR('Booking or Flight not found.', 16, 1);
        RETURN;
    END

    -- 24 hours rule
    IF DATEDIFF(HOUR, GETDATE(), @DepartureTime) > 24
    BEGIN
        RAISERROR('Check-in is only available 24 hours before flight.', 16, 1);
        RETURN;
    END

    -- Check if already departed
    IF GETDATE() > @DepartureTime
    BEGIN
         RAISERROR('Flight has already departed.', 16, 1);
         RETURN;
    END

    UPDATE Bookings SET Status = 'CHECKED_IN' WHERE BookingID = @BookingID;
END;
GO

-- STORED PROCEDURE: UpdateFlightStatuses
-- SP 5: Auto-Update Flight Statuses
-- I added this to help the admin.
-- Instead of changing flight status one by one, this procedure checks the time for all flights 
-- and automatically closes the ones that have already taken off.

-- SAKLI PROSEDÜR: Uçuş Durumlarını Güncelle
-- SP 5: Uçuş Durumlarını Otomatik Güncelleme
-- Yöneticiye yardımcı olmak için bunu ekledim.
-- Uçuş durumunu tek tek değiştirmek yerine, bu prosedür tüm uçuşların zamanını kontrol eder
-- ve zaten kalkmış olanları otomatik olarak kapatır.

CREATE PROCEDURE sp_UpdateFlightStatuses
AS
BEGIN
    UPDATE Flights 
    SET Status = 'COMPLETED' 
    WHERE DepartureTime < GETDATE() AND Status = 'SCHEDULED';
END;
GO

-- 3. FUNCTIONS (At least 3)

-- FN 1: Get Available Seats Count
-- FUNCTION: GetAvailableSeats
-- It calculates the remaining seats for a flight dynamically.
-- I use this inside my Views so that customers always see the real-time seat count when searching for flights.

-- FN 1: Mevcut Koltuk Sayısını Al
-- FONKSİYON: GetAvailableSeats
-- Bir uçuş için kalan koltuk sayısını dinamik olarak hesaplar.
-- Müşteriler uçuş ararken her zaman gerçek zamanlı koltuk sayısını görebilsinler diye bunu Görünümlerimde kullanıyorum.

CREATE FUNCTION fn_GetAvailableSeats(@FlightID INT)
RETURNS INT
AS
BEGIN
    DECLARE @Total INT = (SELECT TotalSeats FROM Flights WHERE FlightID = @FlightID);
    DECLARE @Booked INT = (SELECT COUNT(*) FROM Bookings WHERE FlightID = @FlightID AND Status <> 'CANCELLED');
    RETURN @Total - @Booked;
END;
GO

-- FN 2: Calculate Total Revenue for a Flight
-- FUNCTION: FlightRevenue
-- I created this for the Owner Dashboard.
-- It sums up the ticket prices of all confirmed bookings for a specific flight.
-- This way, the owner can see how much money each flight has made.

-- FN 2: Bir Uçuş İçin Toplam Geliri Hesapla
-- FONKSİYON: FlightRevenue
-- Bunu Sahip Kontrol Paneli için oluşturdum.
-- Belirli bir uçuş için onaylanmış tüm rezervasyonların bilet fiyatlarını toplar.
-- Bu sayede sahip, her uçuşun ne kadar para kazandırdığını görebilir.
CREATE FUNCTION fn_FlightRevenue(@FlightID INT)
RETURNS DECIMAL(10,2)
AS
BEGIN
    DECLARE @Revenue DECIMAL(10,2);
    SELECT @Revenue = SUM(TicketPrice) FROM Bookings 
    WHERE FlightID = @FlightID AND Status <> 'CANCELLED';
    
    RETURN ISNULL(@Revenue, 0);
END;
GO

-- FN 3: Get Flight Duration in Hours
-- FUNCTION: GetFlightDuration
-- Designed for better User Experience on the schedule page.
-- Instead of showing raw dates, it calculates the time difference and formats it nicely (e.g., "2h 15m")
-- so users can easily see how long the flight takes.

-- FN 3: Uçuş Süresini Saat Olarak Al
-- FONKSİYON: GetFlightDuration
-- Program sayfasında daha iyi bir Kullanıcı Deneyimi için tasarlanmıştır.
-- Ham tarihleri ​​göstermek yerine, zaman farkını hesaplar ve güzel bir şekilde biçimlendirir (örneğin, "2s 15dk")
-- böylece kullanıcılar uçuşun ne kadar sürdüğünü kolayca görebilirler.
CREATE FUNCTION fn_GetFlightDuration(@FlightID INT)
RETURNS VARCHAR(20)
AS
BEGIN
    DECLARE @Dep DATETIME, @Arr DATETIME;
    SELECT @Dep = DepartureTime, @Arr = ArrivalTime FROM Flights WHERE FlightID = @FlightID;
    
    DECLARE @TotalMinutes INT = DATEDIFF(MINUTE, @Dep, @Arr);
    DECLARE @Hours INT = @TotalMinutes / 60;
    DECLARE @Minutes INT = @TotalMinutes % 60;
    
    RETURN CAST(@Hours AS VARCHAR) + 'h ' + CAST(@Minutes AS VARCHAR) + 'm';
END;
GO

-- 4. TRIGGERS (At least 4)

-- TRG 1: Prevent Double Booking (Extra safety layer)
-- TRIGGER: PreventDoubleBooking
-- Even if the Java application fails to check seat availability properly, 
-- this Trigger catches the error at the database level and stops double bookings.

-- TETİKLEYİCİ 1: Çifte Rezervasyonu Önle (Ekstra güvenlik katmanı)
-- TETİKLEYİCİ: Çifte Rezervasyonu Önle
-- Java uygulaması koltuk müsaitliğini düzgün bir şekilde kontrol edemese bile,
-- bu Tetikleyici hatayı veritabanı düzeyinde yakalar ve çifte rezervasyonları durdurur.

IF OBJECT_ID('trg_PreventDoubleBooking', 'TR') IS NOT NULL DROP TRIGGER trg_PreventDoubleBooking;
GO

CREATE TRIGGER trg_PreventDoubleBooking
ON Bookings
INSTEAD OF INSERT
AS
BEGIN
    IF EXISTS (
        SELECT 1 FROM Bookings b
        JOIN inserted i ON b.FlightID = i.FlightID AND b.SeatNumber = i.SeatNumber
        WHERE b.Status <> 'CANCELLED'
    )
    BEGIN
        RAISERROR('Seat is already occupied.', 16, 1);
    END
    ELSE
    BEGIN
        INSERT INTO Bookings (UserID, FlightID, SeatNumber, BookingDate, Status, TicketPrice, PassengerType, PassengerName)
        SELECT UserID, FlightID, SeatNumber, BookingDate, Status, TicketPrice, PassengerType, PassengerName FROM inserted;
    END
END;
GO

-- TRG 2: Log Booking Cancellations
-- TRIGGER: LogBookingCancellation
-- Automatically records cancellation events into the Logs table.
-- It works behind the scenes whenever a booking status changes to 'CANCELLED',
-- creating a permanent audit trail.

-- TRG 2: Rezervasyon İptallerini Kaydet
-- TETİKLEYİCİ: LogBookingCancellation
-- İptal olaylarını otomatik olarak Kayıtlar tablosuna kaydeder.
-- Bir rezervasyon durumu 'İPTAL EDİLDİ' olarak değiştiğinde arka planda çalışır,
-- kalıcı bir denetim izi oluşturur.

CREATE TRIGGER trg_LogBookingCancellation
ON Bookings
AFTER UPDATE
AS
BEGIN
    IF EXISTS (SELECT 1 FROM inserted WHERE Status = 'CANCELLED') AND EXISTS (SELECT 1 FROM deleted WHERE Status <> 'CANCELLED')
    BEGIN
        INSERT INTO Logs (Action, Details)
        SELECT 'BOOKING_CANCELLED', 'Booking ' + CAST(BookingID AS NVARCHAR) + ' was cancelled.' 
        FROM inserted;
    END
END;
GO

-- TRG 3: Update Flight Status automatically 
-- TRIGGER: LogFlightCompletion
-- Logs when a flight lands.
-- When the automated procedure marks a flight as 'COMPLETED', this trigger fires
-- and saves a "Flight Landed" message to the Logs table.

-- TRG 3: Uçuş Durumunu Otomatik Olarak Güncelle
-- TETİKLEYİCİ: LogFlightCompletion
-- Bir uçuş indiğinde kayıt tutar.
-- Otomatik prosedür bir uçuşu 'TAMAMLANDI' olarak işaretlediğinde, bu tetikleyici çalışır
-- ve "Uçuş İndi" mesajını Kayıtlar tablosuna kaydeder.

CREATE TRIGGER trg_LogFlightCompletion
ON Flights
AFTER UPDATE
AS
BEGIN
    IF EXISTS (SELECT 1 FROM inserted WHERE Status = 'COMPLETED')
    BEGIN
        INSERT INTO Logs (Action, Details)
        SELECT 'FLIGHT_COMPLETED', 'Flight ' + FlightCode + ' has landed.' FROM inserted;
    END
END;
GO

-- TRG 4: Validate Arrival Time
-- TRIGGER: ValidateFlightDates
-- Prevents logical errors in flight scheduling.
-- It ensures that a flight cannot arrive before it departs.
-- If someone tries to enter wrong dates, it rejects the operation immediately.

-- TRG 4: Varış Zamanını Doğrula
-- TETİKLEYİCİ: Uçuş Tarihlerini Doğrula
-- Uçuş planlamasında mantıksal hataları önler.
-- Bir uçuşun kalkıştan önce varamamasını sağlar.
-- Birisi yanlış tarih girmeye çalışırsa, işlemi hemen reddeder.

CREATE TRIGGER trg_ValidateFlightDates
ON Flights
AFTER INSERT, UPDATE
AS
BEGIN
    IF EXISTS (SELECT 1 FROM inserted WHERE ArrivalTime <= DepartureTime)
    BEGIN
        RAISERROR('Arrival time must be after Departure time.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO

-- 5. VIEWS (At least 1)

-- View 1: Public Flight Schedule (User Panel)
-- VIEW: PublicFlightSchedule
-- Created for the main search page.
-- It filters out past or cancelled flights, showing only what users can book.
-- Only shows future flights
-- It also formats the Origin and Destination nicely by joining with the Airports table.

-- 5. GÖRÜNÜMLER (En az 1)

-- Görünüm 1: Genel Uçuş Takvimi (Kullanıcı Paneli)
-- GÖRÜNÜM: PublicFlightSchedule
-- Ana arama sayfası için oluşturulmuştur.
-- Geçmiş veya iptal edilmiş uçuşları filtreleyerek yalnızca kullanıcıların 
-- rezervasyon yapabileceği uçuşları gösterir.
-- Yalnızca gelecekteki uçuşları gösterir.
-- Ayrıca, Kalkış ve Varış noktalarını Havaalanları tablosuyla birleştirerek 
-- düzgün bir şekilde biçimlendirir.
CREATE VIEW vw_PublicFlightSchedule AS
SELECT 
    f.FlightCode,
    ao.City + ' (' + ao.Code + ')' AS Origin,
    ad.City + ' (' + ad.Code + ')' AS Destination,
    f.DepartureTime,
    f.Status,
    f.BasePrice,
    dbo.fn_GetAvailableSeats(f.FlightID) AS AvailableSeats
FROM Flights f
JOIN Airports ao ON f.OriginID = ao.AirportID
JOIN Airports ad ON f.DestinationID = ad.AirportID
WHERE f.DepartureTime > GETDATE() AND f.Status = 'SCHEDULED';
GO



-- View 2: Owner Dashboard (Stats)
-- VIEW: OwnerDashboard
-- Provides a summary report for the business owner.
-- It aggregates booking counts and calculates total revenue per flight using my custom function 'fn_FlightRevenue'.

-- Görünüm 2: İşletme Sahibi Kontrol Paneli (İstatistikler)
-- GÖRÜNÜM: İşletme Sahibi Kontrol Paneli
-- İşletme sahibi için özet bir rapor sunar.
-- Rezervasyon sayılarını toplar ve özel fonksiyonum 'fn_FlightRevenue' 
-- kullanarak uçuş başına toplam geliri hesaplar.
CREATE VIEW vw_OwnerDashboard AS
SELECT 
    f.FlightCode,
    f.Status,
    COUNT(b.BookingID) AS TotalBookings,
    dbo.fn_FlightRevenue(f.FlightID) AS TotalRevenue,
    SUM(CASE WHEN b.PassengerType = 'ADULT' THEN 1 ELSE 0 END) AS AdultCount,
    SUM(CASE WHEN b.PassengerType = 'STUDENT' THEN 1 ELSE 0 END) AS StudentCount,
    SUM(CASE WHEN b.PassengerType = 'CHILD' THEN 1 ELSE 0 END) AS ChildCount
FROM Flights f
LEFT JOIN Bookings b ON f.FlightID = b.FlightID AND b.Status <> 'CANCELLED'
GROUP BY f.FlightID, f.FlightCode, f.Status;
GO

-- Initial Data Seeding
-- İlk veri

INSERT INTO Users (Username, PasswordHash, FullName, Role) VALUES 
('admin', 'admin123', 'System Administrator', 'ADMIN'),
('owner', 'owner123', 'Airline Owner', 'OWNER'),
('kbra', 'kbra123', 'Kübra Demirci', 'USER');

INSERT INTO Airports (Code, City, Name) VALUES 
('IST', 'Istanbul', 'Istanbul Airport'),
('JFK', 'New York', 'John F. Kennedy'),
('LHR', 'London', 'Heathrow'),
('ESB', 'Ankara', 'Esenboga Airport'),
('ERZ', 'Erzurum', 'Erzurum Airport'),
('ADB', 'Izmir', 'Adnan Menderes Airport'),
('AYT', 'Antalya', 'Antalya Airport');

EXEC sp_CreateFlight 'SK100', 'IST', 'JFK', '2025-12-30 08:00', '2025-12-30 18:00', 'Boeing 777', 300, 15000.00;
EXEC sp_CreateFlight 'SK101', 'JFK', 'IST', '2025-12-31 10:00', '2025-12-31 22:00', 'Boeing 777', 300, 14000.00;

-- SCHEMA UPDATE
-- I added these columns later to support special pricing for Students and Children.
-- Instead of recreating the whole table, I used ALTER TABLE to preserve existing data.

-- ŞEMA GÜNCELLEMESİ
-- Öğrenciler ve Çocuklar için özel fiyatlandırmayı desteklemek amacıyla 
-- bu sütunları daha sonra ekledim.
-- Tüm tabloyu yeniden oluşturmak yerine, mevcut verileri korumak için 
--ALTER TABLE komutunu kullandım.
ALTER TABLE Flights ADD PriceStudent DECIMAL(10, 2);
ALTER TABLE Flights ADD PriceChild DECIMAL(10, 2);
GO


