package com.skyfull.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "Flights")
public class Flight {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "FlightID")
    private Integer flightId;

    @Column(name = "FlightCode", unique = true, nullable = false)
    private String flightCode;

    // Simplification: We will just store IDs or do simple mapping for now to speed
    // up.
    // Ideally ManyToOne, but for the deadline, raw IDs or Eager fetching is easier.

    @Column(name = "OriginID")
    private Integer originId;

    @Column(name = "DestinationID")
    private Integer destinationId;

    @Column(name = "DepartureTime", nullable = false)
    private LocalDateTime departureTime;

    @Column(name = "ArrivalTime", nullable = false)
    private LocalDateTime arrivalTime;

    @Column(name = "AircraftType")
    private String aircraftType;

    @Column(name = "TotalSeats")
    private Integer totalSeats;

    @Column(name = "BasePrice")
    private BigDecimal basePrice;

    @Column(name = "PriceStudent")
    private BigDecimal priceStudent;

    @Column(name = "PriceChild")
    private BigDecimal priceChild;

    @Column(name = "Status")
    private String status;

    // Getters and Setters
    public Integer getFlightId() {
        return flightId;
    }

    public void setFlightId(Integer flightId) {
        this.flightId = flightId;
    }

    public String getFlightCode() {
        return flightCode;
    }

    public void setFlightCode(String flightCode) {
        this.flightCode = flightCode;
    }

    public Integer getOriginId() {
        return originId;
    }

    public void setOriginId(Integer originId) {
        this.originId = originId;
    }

    public Integer getDestinationId() {
        return destinationId;
    }

    public void setDestinationId(Integer destinationId) {
        this.destinationId = destinationId;
    }

    public LocalDateTime getDepartureTime() {
        return departureTime;
    }

    public void setDepartureTime(LocalDateTime departureTime) {
        this.departureTime = departureTime;
    }

    public LocalDateTime getArrivalTime() {
        return arrivalTime;
    }

    public void setArrivalTime(LocalDateTime arrivalTime) {
        this.arrivalTime = arrivalTime;
    }

    public String getAircraftType() {
        return aircraftType;
    }

    public void setAircraftType(String aircraftType) {
        this.aircraftType = aircraftType;
    }

    public Integer getTotalSeats() {
        return totalSeats;
    }

    public void setTotalSeats(Integer totalSeats) {
        this.totalSeats = totalSeats;
    }

    public BigDecimal getBasePrice() {
        return basePrice;
    }

    public void setBasePrice(BigDecimal basePrice) {
        this.basePrice = basePrice;
    }

    public BigDecimal getPriceStudent() {
        return priceStudent;
    }

    public void setPriceStudent(BigDecimal priceStudent) {
        this.priceStudent = priceStudent;
    }

    public BigDecimal getPriceChild() {
        return priceChild;
    }

    public void setPriceChild(BigDecimal priceChild) {
        this.priceChild = priceChild;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
