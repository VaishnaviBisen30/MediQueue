function generateSlots(startTime, endTime, breakStart, breakEnd) {
    const slots = [];

    const duration = 30;

    let currentTime = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);

    const breakStartMinutes = breakStart
        ? timeToMinutes(breakStart)
        : null;

    const breakEndMinutes = breakEnd
        ? timeToMinutes(breakEnd)
        : null;

    while (currentTime < end) {

        const slotEnd = currentTime + duration;

        // Don't create a slot beyond working hours
        if (slotEnd > end) {
            break;
        }

        // Skip break time
        if (
            breakStartMinutes !== null &&
            breakEndMinutes !== null &&
            currentTime < breakEndMinutes &&
            slotEnd > breakStartMinutes
        ) {
            currentTime = breakEndMinutes;
            continue;
        }

        slots.push({
            startTime: minutesToTime(currentTime),
            endTime: minutesToTime(slotEnd),
        });

        currentTime = slotEnd;
    }

    return slots;
}


function timeToMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);

    return hours * 60 + minutes;
}


function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}


module.exports = generateSlots;