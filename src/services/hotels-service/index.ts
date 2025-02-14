import hotelRepository from "@/repositories/hotel-repository";
import enrollmentRepository from "@/repositories/enrollment-repository";
import ticketRepository from "@/repositories/ticket-repository";
import { notFoundError } from "@/errors";
import { cannotListHotelsError } from "@/errors/cannot-list-hotels-error";
import { Hotel, Room } from "@prisma/client";
import bookingRepository from "@/repositories/booking-repository";

async function listHotels(userId: number) {
  //Tem enrollment?
  const enrollment = await enrollmentRepository.findWithAddressByUserId(userId);
  if (!enrollment) {
    throw notFoundError();
  }
  //Tem ticket pago isOnline false e includesHotel true
  const ticket = await ticketRepository.findTicketByEnrollmentId(enrollment.id);

  if (!ticket || ticket.status === "RESERVED" || ticket.TicketType.isRemote || !ticket.TicketType.includesHotel) {
    throw cannotListHotelsError();
  }
}

async function getHotels(userId: number) {
  await listHotels(userId);

  const hotels = await hotelRepository.findHotels();
  return hotels;
}

async function getHotelsWithRooms(userId: number, hotelId: number) {
  await listHotels(userId);
  const hotel = await hotelRepository.findRoomsByHotelId(hotelId);

  if(!hotel) {
    throw notFoundError();
  }

  const roomTypes = hotelRoomTypes(hotel);
  const vacancy = await hotelVacancy(hotel);
  return {
    ...hotel,
    roomTypes,
    ...vacancy
  };
}

function hotelRoomTypes(hotel: Hotel & {
  Rooms: Room[];
}) {
  function hotelCapacity(array: Room[], x: number, l=0, r=array.length-1): boolean {
    if(l > r) return false; 
    const mid = Math.floor((l+r)/2);
    if(array[mid].capacity === x) return true;
    
    if(array[mid].capacity > x) return hotelCapacity(array, x, l, r=mid-1);
    if(array[mid].capacity < x) return hotelCapacity(array, x, l=mid+1, r);
  }

  const rooms = hotel.Rooms;

  return {
    single: hotelCapacity(rooms, 1),
    double: hotelCapacity(rooms, 2),
    triple: hotelCapacity(rooms, 3),
  };  
}

async function hotelVacancy(hotel: Hotel & {
  Rooms: Room[];
}) {
  const bookings = await bookingRepository.countHotelBookings(hotel.id);
  const totalCapacity: number = (hotel.Rooms).map((room) => room?.capacity).reduce((total, room) => total+room, 0);
  
  return {
    vacancy: totalCapacity - bookings
  };
}

const hotelService = {
  getHotels,
  getHotelsWithRooms,
  listHotels,
};

export default hotelService;
