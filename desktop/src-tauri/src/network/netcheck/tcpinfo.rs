use tokio::net::TcpStream;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TcpStats {
    pub timestamps: bool,
    pub syn_retrans: Option<u8>,
}

#[cfg(target_os = "linux")]
pub fn read(stream: &TcpStream) -> Option<TcpStats> {
    use std::os::fd::AsRawFd;

    const TCPI_OPT_TIMESTAMPS: u8 = 1;
    let mut info: libc::tcp_info = unsafe { std::mem::zeroed() };
    let mut len = std::mem::size_of::<libc::tcp_info>() as libc::socklen_t;
    let rc = unsafe {
        libc::getsockopt(
            stream.as_raw_fd(),
            libc::IPPROTO_TCP,
            libc::TCP_INFO,
            (&mut info as *mut libc::tcp_info).cast(),
            &mut len,
        )
    };
    (rc == 0).then_some(TcpStats {
        timestamps: info.tcpi_options & TCPI_OPT_TIMESTAMPS != 0,
        syn_retrans: None,
    })
}

#[cfg(windows)]
pub fn read(stream: &TcpStream) -> Option<TcpStats> {
    use std::os::windows::io::AsRawSocket;
    use windows_sys::Win32::Networking::WinSock::{
        SIO_TCP_INFO, SOCKET_ERROR, TCP_INFO_v0, WSAIoctl,
    };

    let version: u32 = 0;
    let mut info: TCP_INFO_v0 = unsafe { std::mem::zeroed() };
    let mut returned: u32 = 0;
    let rc = unsafe {
        WSAIoctl(
            stream.as_raw_socket() as usize,
            SIO_TCP_INFO,
            (&version as *const u32).cast(),
            std::mem::size_of::<u32>() as u32,
            (&mut info as *mut TCP_INFO_v0).cast(),
            std::mem::size_of::<TCP_INFO_v0>() as u32,
            &mut returned,
            std::ptr::null_mut(),
            None,
        )
    };
    (rc != SOCKET_ERROR).then_some(TcpStats {
        timestamps: info.TimestampsEnabled,
        syn_retrans: Some(info.SynRetrans),
    })
}

#[cfg(not(any(target_os = "linux", windows)))]
pub fn read(_stream: &TcpStream) -> Option<TcpStats> {
    None
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::read;

    #[tokio::test]
    async fn a_loopback_connection_reports_its_options() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let accept = tokio::spawn(async move { listener.accept().await.map(|(socket, _)| socket) });
        let stream = tokio::net::TcpStream::connect(addr).await.unwrap();
        let _server = accept.await.unwrap().unwrap();
        let stats = read(&stream).expect("TCP_INFO on loopback");
        let sysctl = std::fs::read_to_string("/proc/sys/net/ipv4/tcp_timestamps")
            .map(|value| value.trim() != "0")
            .unwrap_or(stats.timestamps);
        assert_eq!(stats.timestamps, sysctl);
        assert_eq!(stats.syn_retrans, None);
    }
}
