use voice_audio::{devices, permission};

fn main() {
    println!("permission: {:?}", permission::status());
    let list = devices::list();
    for (title, devices) in [("inputs", &list.inputs), ("outputs", &list.outputs)] {
        println!("{title}");
        for d in devices {
            println!(
                "  {}{} [{}] {} group={:?}",
                if d.default { "*" } else { " " },
                d.name,
                d.transport.as_str(),
                d.id,
                d.group
            );
        }
    }
}
