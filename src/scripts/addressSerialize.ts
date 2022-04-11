import * as cardanoAddresses from 'cardano-addresses';

const run = async () => {
    const address = 'addr1v8shg50nxt4ad7z7s25g7aaj390fajr533apwuqdrs57aug9wxm96'; // 'addr1qyufadlzhjfhj2lv6qcf45xkc9tz6xc7t2l4uwqheel7gd73zzqrg5denlr3pcre4utltelfte0ts5zpnhjjpwu6aldqzc4wmn'; // 'addr1wywukn5q6lxsa5uymffh2esuk8s8fel7a0tna63rdntgrysv0f3ms';

    const inspectedAddress = await cardanoAddresses.inspectAddress(address);
    console.log(inspectedAddress);
    process.exit();
}

run();